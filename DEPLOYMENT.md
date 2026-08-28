# Deployment Guide — Kubernetes

How the AI Route Optimization Engine is built, shipped, and run. Deployment is
fully automated: **push to `main` → GitHub Actions builds both images, pushes them
to the private registry, and rolls the Deployments in the `alpha` namespace** using
a kubeconfig stored in GitHub secrets.

Manifests live in [k8s/](k8s/). The pipeline lives in
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

---

## 1. Architecture at a glance

Two workloads, one namespace (`alpha`), each behind its own Traefik Ingress with a
cert-manager–issued TLS certificate.

```
                 Internet
                    │
       ┌────────────┴─────────────┐
       │      Traefik Ingress     │  (ingressClassName: traefik, websecure)
       │   TLS via cert-manager   │  (clusterIssuer: letsencrypt)
       └──┬────────────────────┬──┘
          │                    │
route-optimizer.        mcp.route-optimizer.
nikhilbhatia.com        nikhilbhatia.com
          │                    │
   Service :80           Service :80        (both ClusterIP)
          │                    │
  Deployment              Deployment
  route-optimizer         route-optimizer-mcp
  (Next.js :3000)         (Express MCP :3001)
  UI + /api/*             POST /mcp + tool REST API
          │                    │
   app-config CM          mcp-config CM
   app-secrets Secret     mcp-secrets Secret
          │
   External Postgres (DATABASE_URL) ── managed/out-of-cluster
```

| Component | Workload | Image | Port | Host | Health |
| --- | --- | --- | --- | --- | --- |
| App (UI + API) | `deployment/route-optimizer` | `<registry>/route-optimizer` | 3000 | `route-optimizer.nikhilbhatia.com` | `/api/v1/health` |
| MCP server | `deployment/route-optimizer-mcp` | `<registry>/route-optimizer-mcp` | 3001 | `mcp.route-optimizer.nikhilbhatia.com` | `/health` |

The app is a **Next.js monolith** — the browser UI and the `/api/*` route handlers
run in the same process, so they ship as a single Deployment. The MCP server is a
separate Express service that loads the app's `src/lib` optimization engine at
runtime (which is why its Docker build context must be the repo root).

---

## 2. Manifest inventory

```
k8s/
  namespace.yaml            # the `alpha` namespace
  shared-config.yaml        # app-config ConfigMap + app-secrets Secret   [gitignored]
  alpha-admin-sa.yaml       # ServiceAccount + RoleBinding + static token for CI
  alpha-admin.kubeconfig    # kubeconfig built from that token            [gitignored]
  build-and-push.sh         # local equivalent of the CI pipeline
  app/
    10-deployment.yaml      # Next.js standalone
    20-service.yaml         # ClusterIP :80 → :3000
    40-ingress.yaml         # TLS host → app service
  mcp-server/
    00-config.yaml          # mcp-config ConfigMap + mcp-secrets Secret   [gitignored]
    10-deployment.yaml      # Express MCP server
    20-service.yaml         # ClusterIP :80 → :3001
    40-ingress.yaml         # TLS host → mcp service
    Dockerfile              # MCP image (build context = repo root)
```

The numeric prefixes encode apply order: config → deployment → service → ingress.

### Workload shape (both Deployments)

Both Deployments are configured identically in spirit:

- **`replicas: 1`**, `RollingUpdate` with `maxSurge: 1` / `maxUnavailable: 0` — a new
  pod must become Ready before the old one is torn down, so rollouts are zero-downtime.
- **Config injected via `envFrom`** — the whole ConfigMap and the whole Secret are
  projected as environment variables. Adding a config key means editing the ConfigMap
  and restarting, not editing the Deployment.
- **Liveness + readiness probes** on the health endpoints, so a bad image fails the
  rollout instead of serving traffic.
- **Security context**: `runAsNonRoot` as UID 1001, `allowPrivilegeEscalation: false`,
  all Linux capabilities dropped. (`readOnlyRootFilesystem` is left `false` — Next.js
  writes to its cache dir.)
- **`imagePullSecrets: docker-registry-auth`** — the private registry credential,
  created once per namespace (see §5).
- **Resources**

  | | requests | limits |
  | --- | --- | --- |
  | app | 250m CPU / 512Mi | 1500m CPU / 1536Mi |
  | mcp | 150m CPU / 256Mi | 1000m CPU / 768Mi |

- `terminationGracePeriodSeconds: 30`, `revisionHistoryLimit: 5` (five revisions
  available for `kubectl rollout undo`).

### Configuration split

| Source | Holds | Notes |
| --- | --- | --- |
| `app-config` ConfigMap | `NODE_ENV`, `PORT`, `NEXTAUTH_URL`, `OSRM_SERVER_URL`, engine limits (`MAX_LOCATIONS`, `MAX_CABS`, `OPTIMIZATION_TIMEOUT`), cache TTLs, rate-limit settings, `EMAIL_FROM` | Non-secret runtime config |
| `app-secrets` Secret | `DATABASE_URL`, `NEXTAUTH_SECRET`, Stripe keys/price IDs, Google + GitHub OAuth credentials, Mapbox token | |
| `mcp-config` ConfigMap | `MCP_HTTP_PORT/HOST`, `MCP_REQUIRE_AUTH`, CORS origins (`chat.openai.com`, `claude.ai`), engine limits, log level | |
| `mcp-secrets` Secret | `MCP_API_KEYS` (comma-separated keys accepted by the MCP HTTP server) | Auth is enforced in-app, not at the Ingress |

> **`NEXT_PUBLIC_*` variables are a build-time concern.** Next.js inlines them into
> the client bundle, so setting them in the ConfigMap only affects the server. The
> Mapbox token is passed as a Docker `--build-arg` in both the workflow and
> `build-and-push.sh`; changing it requires a **rebuild**, not just a restart.

---

## 3. CI/CD — GitHub Actions

**Workflow:** `Build & Deploy (alpha)` — [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

**Triggers**
- `push` to `main` → image tagged with the commit SHA
- `workflow_dispatch` → optional `tag` input, defaults to the commit SHA

`concurrency: deploy-alpha` with `cancel-in-progress: false` serializes deploys —
two pushes in quick succession queue rather than race.

**Steps**

1. **Checkout** the repo.
2. **Resolve tag** — `inputs.tag || github.sha`.
3. **Set up Buildx**, then **log in** to the private registry.
4. **Build & push the app image** from `./Dockerfile`, context `.`, platform
   `linux/amd64`, with `NEXT_PUBLIC_MAPBOX_TOKEN` as a build arg. Tagged
   `:<sha>` **and** `:latest`. GitHub Actions layer cache (`type=gha`) on both images.
5. **Build & push the MCP image** from `./k8s/mcp-server/Dockerfile`, context `.`
   (repo root, required — the image copies `src/lib/`). Tagged `:<sha>` and `:latest`.
6. **Set up kubectl** (`azure/setup-kubectl@v4`).
7. **Configure kubeconfig** — writes the `KUBECONFIG` secret to `~/.kube/config`
   with mode `600`.
8. **Deploy** — `kubectl set image` on both Deployments to the immutable `:<sha>` tag,
   then `kubectl rollout status ... --timeout=180s` on each. A failed readiness probe
   fails the job.

### Required GitHub secrets

Configured under **Settings → Secrets and variables → Actions**:

| Secret | Used for |
| --- | --- |
| `KUBECONFIG` | Full kubeconfig YAML for the cluster; written to `~/.kube/config` at deploy time |
| `REGISTRY_SERVER` | Registry host — also forms `IMAGE_REPO` (`$REGISTRY_SERVER/route-optimizer`) |
| `REGISTRY_USERNAME` | Registry login |
| `REGISTRY_PASSWORD` | Registry login |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Build arg baked into the client bundle |

**Where the kubeconfig comes from.** [k8s/alpha-admin-sa.yaml](k8s/alpha-admin-sa.yaml)
creates an `alpha-admin` ServiceAccount, a RoleBinding granting it the built-in `admin`
ClusterRole **scoped to the `alpha` namespace only**, and a
`kubernetes.io/service-account-token` Secret holding a static, non-expiring token. The
kubeconfig is assembled from that token and pasted into the `KUBECONFIG` GitHub secret.
So the CI credential can do anything inside `alpha` and nothing outside it.

To regenerate it:

```bash
kubectl apply -f k8s/alpha-admin-sa.yaml
kubectl -n alpha get secret alpha-admin-token -o jsonpath='{.data.token}' | base64 -d
# build a kubeconfig with that token + the cluster CA and server URL,
# then paste the whole file into the KUBECONFIG repository secret
```

### What CI does *not* do

This is the important boundary:

- **CI only updates container images.** It never runs `kubectl apply`. Changes to
  Deployments, Services, Ingresses, ConfigMaps, or Secrets must be applied manually
  (see §5). A manifest edit merged to `main` does **not** reach the cluster on its own.
- **CI does not run database migrations.** `prisma migrate deploy` is a manual step.
- **CI does not create the namespace, the registry pull secret, or the config/secret
  objects.** Those are one-time bootstrap steps.
- `shared-config.yaml`, `mcp-server/00-config.yaml`, and `alpha-admin.kubeconfig` are
  **gitignored** — they hold live credentials and are not in the repo. Keep it that way;
  the CI runner never sees them.

---

## 4. Deploy flows

### Normal path (automatic)

```
git push origin main
  → images built and pushed as :<sha> and :latest
  → kubectl set image on both Deployments
  → rollout status gate (180s each)
```

Watch it in the Actions tab, or from a shell:

```bash
kubectl -n alpha rollout status deploy/route-optimizer
kubectl -n alpha get pods -w
```

### Manual redeploy of a specific tag

Actions → *Build & Deploy (alpha)* → **Run workflow** → set `tag`.

### Local build & deploy (bypasses CI)

```bash
./k8s/build-and-push.sh registry.kube.nikhilbhatia.com/route-optimizer v1
```

Builds both images for `linux/amd64`, pushes them, and runs
`kubectl rollout restart` + `rollout status` on both Deployments. Tunable via env:
`PUSH`, `ROLLOUT`, `BUILD_APP`, `BUILD_MCP`, `PLATFORM`, `NAMESPACE`.

Note the difference: the script relies on `:latest` + `rollout restart`, while CI
pins an immutable `:<sha>` via `set image`. **Prefer CI** — pinned tags make the
running version identifiable and rollbacks deterministic.

### Rollback

```bash
kubectl -n alpha rollout undo deployment/route-optimizer
# or pin a known-good SHA
kubectl -n alpha set image deployment/route-optimizer app=<registry>/route-optimizer:<sha>
kubectl -n alpha rollout status deployment/route-optimizer
```

---

## 5. First-time cluster bootstrap

Cluster prerequisites: **Traefik** ingress controller, **cert-manager** with a
ClusterIssuer named `letsencrypt`, DNS A/CNAME records for both hosts, and a
reachable Postgres for `DATABASE_URL`.

```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Registry pull secret (referenced by both Deployments as `docker-registry-auth`)
kubectl -n alpha create secret docker-registry docker-registry-auth \
  --docker-server=<registry> --docker-username=<user> --docker-password=<pass>

# 3. Config + secrets (local, gitignored files)
kubectl apply -f k8s/shared-config.yaml
kubectl apply -f k8s/mcp-server/00-config.yaml

# 4. CI service account, then extract the kubeconfig into the GitHub secret
kubectl apply -f k8s/alpha-admin-sa.yaml

# 5. Database schema
npx prisma migrate deploy   # against DATABASE_URL

# 6. Workloads
kubectl apply -R -f k8s/app -f k8s/mcp-server

# 7. Verify
kubectl -n alpha get pods,svc,ingress
curl -fsS https://route-optimizer.nikhilbhatia.com/api/v1/health
curl -fsS https://mcp.route-optimizer.nikhilbhatia.com/health
```

After bootstrap, push to `main` and CI takes over image updates.

### Applying a manifest change later

```bash
kubectl apply -f k8s/app/10-deployment.yaml      # or whichever file changed
# ConfigMap/Secret edits do not restart pods on their own:
kubectl -n alpha rollout restart deploy/route-optimizer
```

---

## 6. Operations

```bash
# Status
kubectl -n alpha get pods,svc,ingress
kubectl -n alpha describe pod <pod>

# Logs
kubectl -n alpha logs -f deploy/route-optimizer
kubectl -n alpha logs -f deploy/route-optimizer-mcp

# Which image is actually running
kubectl -n alpha get deploy -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'

# Shell / port-forward
kubectl -n alpha exec -it deploy/route-optimizer -- sh
kubectl -n alpha port-forward deploy/route-optimizer 3000:3000

# Scale
kubectl -n alpha scale deploy/route-optimizer --replicas=3

# TLS troubleshooting
kubectl -n alpha get certificate,certificaterequest
kubectl -n alpha describe ingress route-optimizer
```

**Common failures**

| Symptom | Likely cause |
| --- | --- |
| `ImagePullBackOff` | `docker-registry-auth` missing/expired in `alpha`, or the tag was never pushed |
| `CrashLoopBackOff` on the app | Bad `DATABASE_URL`, missing migration, or a missing key in `app-secrets` |
| Pods Ready but rollout times out | Health endpoint failing — check probe paths `/api/v1/health` and `/health` |
| 404/503 at the domain | DNS not pointing at the ingress, or `ingressClassName` mismatch |
| Cert stuck `Pending` | ClusterIssuer name mismatch, or HTTP-01 challenge can't reach the host |
| Map renders blank after a config change | `NEXT_PUBLIC_MAPBOX_TOKEN` is a build arg — needs a rebuild, not a restart |
| CI deploy step fails on auth | `KUBECONFIG` secret stale — the SA token or cluster CA rotated |

---

## 7. Known gaps and hardening notes

Worth tracking, none of it blocking:

- **[k8s/README.md](k8s/README.md) is stale.** It describes an nginx ingress class, a
  `letsencrypt-prod` ClusterIssuer, and `*.kube.nikhilbhatia.com` hosts. The live
  manifests use **Traefik**, the **`letsencrypt`** issuer, and
  `route-optimizer.nikhilbhatia.com` / `mcp.route-optimizer.nikhilbhatia.com`.
  This document reflects the manifests.
- **Single replica, no HPA, no PodDisruptionBudget.** Every node drain or rollout is a
  brief single point of failure for each service. Bump `replicas` and add an HPA before
  treating this as production-grade.
- **Secrets are plaintext `stringData` in local files.** They're kept out of git by
  `.gitignore`, but there's no encryption at rest in the workflow and no rotation story.
  Sealed-secrets or external-secrets would let the manifests be committed safely.
  A leaked `shared-config.yaml` exposes the DB password, `NEXTAUTH_SECRET`, Stripe and
  OAuth client secrets at once.
- **The CI service-account token is static and non-expiring.** Convenient, but it should
  be rotated deliberately; there's no expiry forcing the issue.
- **`REGISTRY_SERVER` must match the registry hardcoded in the Deployment manifests**
  (`registry.kube.nikhilbhatia.com`). If the secret ever points elsewhere, `set image`
  will silently switch registries while `kubectl apply` reverts it.
- **No NetworkPolicies** — pods in `alpha` can reach anything the cluster allows.
- **No migration step in CI**, so a schema change requires a manual `prisma migrate
  deploy` timed around the rollout.
