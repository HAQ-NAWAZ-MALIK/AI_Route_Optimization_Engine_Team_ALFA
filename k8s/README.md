# Kubernetes manifests

Deploys the AI Route Optimization Engine to the `alpha` namespace as two components:

| Component    | What it is                                          | Image                                                | Port | Host                                        |
| ------------ | --------------------------------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------- |
| `app`        | Next.js standalone — serves both the UI (`/`) and the API (`/api/*`) | `registry.kube.nikhilbhatia.com/route-optimizer`     | 3000 | `route-optimizer.kube.nikhilbhatia.com`     |
| `mcp-server` | Express MCP endpoint (`POST /mcp`) + tool REST API  | `registry.kube.nikhilbhatia.com/route-optimizer-mcp` | 3001 | `mcp.route-optimizer.kube.nikhilbhatia.com` |

The application is a single Next.js monolith: the UI and the backend `/api/*` route
handlers run in the same process, so they ship as one Deployment (`app`). It reads
`app-config` (ConfigMap) and `app-secrets` (Secret) from `shared-config.yaml`. The MCP
server is a separate Express service that loads the app's `src/lib` optimization engine
at runtime.

## Layout

```
k8s/
  namespace.yaml          # alpha namespace
  shared-config.yaml      # app-config ConfigMap + app-secrets Secret
  app/                    # deployment, service, ingress (UI + /api)
  mcp-server/             # config (cm+secret), deployment, service, ingress, Dockerfile
```

## Before applying

1. **Fill in secrets.** Every `REPLACE_ME` in `shared-config.yaml` and `mcp-server/00-config.yaml`
   must be replaced, or manage the Secrets out-of-band (sealed-secrets / external-secrets /
   `kubectl create secret`). Do **not** commit real credentials.
2. **Set the hosts** to your real domains (search/replace `route-optimizer.kube.nikhilbhatia.com`).
3. **Assumptions** — the cluster has: nginx ingress controller (`ingressClassName: nginx`),
   cert-manager with a `letsencrypt-prod` ClusterIssuer. Adjust annotations if you use
   Traefik/other. Scaling is fixed via each Deployment's `replicas` (no HPA).
4. **Database / Redis** are expected as managed/external services (see `DATABASE_URL` /
   `REDIS_URL` in `app-secrets`). Run `prisma migrate deploy` against the DB before first boot.

## Build & push images

Use the helper (builds both images and rolls both deployments):

```bash
./k8s/build-and-push.sh registry.kube.nikhilbhatia.com/route-optimizer v1
```

Or manually:

```bash
# App — from repo root
docker build -f Dockerfile -t registry.kube.nikhilbhatia.com/route-optimizer:latest .
docker push registry.kube.nikhilbhatia.com/route-optimizer:latest

# MCP server — build context MUST be the repo root (loads src/lib engine at runtime)
docker build -f k8s/mcp-server/Dockerfile -t registry.kube.nikhilbhatia.com/route-optimizer-mcp:latest .
docker push registry.kube.nikhilbhatia.com/route-optimizer-mcp:latest
```

## Apply

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/shared-config.yaml
kubectl apply -R -f k8s/app -f k8s/mcp-server

kubectl -n alpha rollout status deploy/route-optimizer
kubectl -n alpha rollout status deploy/route-optimizer-mcp
```

## Verify

```bash
kubectl -n alpha get pods,svc,ingress
curl -fsS https://route-optimizer.nikhilbhatia.com/api/v1/health
curl -fsS https://mcp.route-optimizer.nikhilbhatia.com/health
```
