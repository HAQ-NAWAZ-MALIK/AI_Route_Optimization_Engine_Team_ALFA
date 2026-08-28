# 🚀 AI Route Optimization Engine

A production **route-optimization SaaS platform** built on Next.js 15 — a multi-algorithm optimization engine wrapped in a metered public API, a customer portal, an admin console, Stripe billing, and an MCP server for LLM clients.

[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)](https://www.postgresql.org/)

**Live:** [route-optimizer.nikhilbhatia.com](https://route-optimizer.nikhilbhatia.com) · **MCP:** [mcp.route-optimizer.nikhilbhatia.com](https://mcp.route-optimizer.nikhilbhatia.com)

---

## ✨ What's in here

### Optimization engine
- **6 algorithms**, raced in parallel by the auto-optimizer: Nearest Neighbor, Christofides (+2-opt), Genetic Algorithm, Exhaustive Search, **Dijkstra**, and **BMSSP** (*Breaking the Sorting Barrier for Directed SSSP*, Duan et al. 2024 — falls back to Dijkstra under 100 nodes)
- **Multi-cluster optimization** — employee grouping, cab packing, utilization and overflow handling
- **Distribution analyzer** — AI strategy scoring, constraint checks, warnings, manual overrides
- **Time-window solving** (VRPTW-style) and **live traffic** via TomTom flow + incidents
- **Real road routing** through Mapbox Directions and OSRM (matrix, trip, nearest, polyline)
- **Two-tier cache** — in-memory L1 + optional Redis L2 for distance matrices, segments and whole results

### Platform
- **Public REST API** (`/api/v1`) with API-key auth, scoped permissions, rate limiting and per-plan quotas
- **Auth** — NextAuth v5: email/password (bcrypt) plus optional Google and GitHub OAuth, email verification and password reset
- **Customer portal** — dashboard, API-key management, usage analytics, billing, interactive API docs, settings
- **Admin console** — users, keys, revenue/usage/error analytics, promo codes, broadcast notifications, platform config (rate limits, plan quotas, feature flags, maintenance mode)
- **Stripe billing** — FREE / TRIAL / PRO / ENTERPRISE plans, monthly + yearly, promo codes, invoices, signature-verified webhooks, per-request usage metering
- **Observability** — Prometheus metrics at `/api/v1/metrics`, structured JSON logging, audit log
- **Transactional email** via Resend, plus an in-app notification center

### Adjacent surfaces
- **MCP server** (`mcp-server/`) — stdio + HTTP transports exposing `optimize_route`, `optimize_multi_cluster`, `calculate_distance_matrix` to Claude Desktop and other MCP clients
- **Telegram bot** (`telegram-bot/`) — Python front-end over the public API
- **Demo pages** — `/` (Mapbox demo), `/demo-ai-optimizer` (CSV-driven multi-cluster), `/animation` (canvas school-bus simulation with a live algorithm race)

---

## 📦 Project structure

```
.
├── src/
│   ├── app/
│   │   ├── (auth)/             # login, signup
│   │   ├── (portal)/           # dashboard, api-keys, usage, billing, docs, settings
│   │   ├── admin/              # admin console
│   │   ├── api/
│   │   │   ├── v1/             # public API (API-key auth)
│   │   │   ├── auth/           # NextAuth + signup/verify/reset
│   │   │   ├── portal/         # session-authenticated portal API
│   │   │   ├── admin/          # admin API
│   │   │   ├── demo/           # unauthenticated demo endpoints
│   │   │   └── webhooks/       # Stripe webhook
│   │   ├── animation/          # canvas simulation
│   │   └── demo-ai-optimizer/  # CSV demo
│   ├── components/             # portal, charts, notifications, animation, ui
│   └── lib/
│       ├── ai-engine/          # 6 algorithms + OSRM/Mapbox/traffic clients
│       ├── api/                # middleware, schemas, rate limiter, permissions
│       ├── auth/  billing/     # NextAuth config, plans, usage calculator
│       ├── cache/  monitoring/ # L1+L2 cache, Prometheus metrics, logger
│       └── email/  notifications/  analytics/  audit/  config/
├── prisma/                     # schema.prisma + seed.ts (PostgreSQL)
├── mcp-server/                 # MCP server (stdio + HTTP)
├── telegram-bot/               # Python Telegram bot
├── scripts/                    # operational + integration test scripts
├── k8s/                        # Kubernetes manifests (app/ + mcp-server/)
├── .github/workflows/          # build & deploy to the alpha namespace
├── public/                     # static demo pages + sample CSVs
├── Dockerfile                  # app image (Next.js standalone)
├── docker-compose.yml          # local Postgres + Redis
└── openapi.yaml                # public API specification
```

---

## 🛠️ Local installation

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | **20** recommended | `engines` requires `>=18`; the Docker images use 20 |
| npm | 9+ | npm only — the repo has `package-lock.json` |
| PostgreSQL | 15 | Easiest via the bundled `docker-compose.yml` |
| Redis | 7 | Optional — the cache falls back to in-memory |
| Python | 3.8+ | Only if you want to run the Telegram bot |

You will need a **Mapbox token** ([get one here](https://account.mapbox.com/access-tokens/)) for the map and road routing. Stripe, Resend and OAuth credentials are all optional — the app builds and runs without them; only the features that use them are disabled.

### 1. Clone and install

```bash
git clone git@github.com:HAQ-NAWAZ-MALIK/AI_Route_Optimization_Engine_Team_ALFA.git
cd AI_Route_Optimization_Engine_Team_ALFA
npm install
```

### 2. Start the database (and cache)

```bash
docker compose up -d postgres redis
```

> Start **only** these two services. The `optimizer` service in `docker-compose.yml` builds the production image without a `DATABASE_URL`, so it cannot serve the portal, admin or auth routes — run the app with `npm run dev` on the host instead.

Already have Postgres? Just point `DATABASE_URL` at it and skip this step.

### 3. Configure the environment

```bash
cp .env.example .env.local
```

Then edit `.env.local`. The minimum to boot a working app:

```bash
# Must match the docker-compose credentials above
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

NEXTAUTH_SECRET="<paste output of: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"

NEXT_PUBLIC_MAPBOX_TOKEN="pk.…"
```

See [Environment variables](#-environment-variables) for the full list.

> The datasource provider in `prisma/schema.prisma` is hardcoded to `postgresql`. The SQLite hint in `.env.example` and `QUICK_START.md` will **not** work without editing the schema.

### 4. Create the schema and seed

```bash
npx prisma generate
npx prisma db push     # or: npm run db:push
npm run db:seed
```

There is no `prisma/migrations/` directory — `db push` is the only supported path. Ignore any doc that tells you to run `prisma migrate deploy`.

The seed is idempotent and creates:

| Account | Password | Role |
|---|---|---|
| `admin@routeoptimizer.dev` | `Admin123!` | ADMIN |
| `demo@routeoptimizer.dev` | `Demo1234!` | USER |

…plus FREE subscriptions, a demo API key (printed once — copy it), the platform config row, promo codes `LAUNCH50` / `WELCOME10`, and a welcome notification.

### 5. Run the app

```bash
npm run dev
```

- App → http://localhost:3000
- Health → http://localhost:3000/api/v1/health
- Portal → http://localhost:3000/dashboard
- Admin → http://localhost:3000/admin/dashboard
- Prisma Studio → `npx prisma studio` → http://localhost:5555

### 6. Optional — MCP server

```bash
npm run mcp:install
cd mcp-server && cp .env.example .env   # set MCP_REQUIRE_AUTH=false for local use
cd .. && npm run mcp:http               # http://localhost:3001
```

Use `npm run mcp:dev` for the stdio transport (what Claude Desktop connects to). Both entry points run through `tsx` because the MCP server loads the app's TypeScript engine from `src/lib/` at runtime — `npm run mcp:build` output is **not** runnable with bare `node`. See [MCP_SETUP.md](MCP_SETUP.md) for the Claude Desktop config block.

### 7. Optional — Telegram bot

```bash
cd telegram-bot
pip install -r requirements.txt
python bot.py     # long-polls; calls http://localhost:3000/api/v1
```

> ⚠️ `telegram-bot/bot.py` has a live bot token and Mapbox token **hardcoded in source**. Rotate them and move them to environment variables before using this in anger.

### Ports

| Service | Port |
|---|---|
| Next.js app | 3000 |
| MCP HTTP server | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Prisma Studio | 5555 |

### Verifying the setup

```bash
node demo-foundation.js                    # standalone smoke test (password + key gen)
curl http://localhost:3000/api/v1/health
curl http://localhost:3001/health          # if the MCP server is running
npx tsc --noEmit                           # typecheck
npm run lint
```

There is **no test runner** in this repo — no jest/vitest suite exists. `scripts/*.ts` are integration scripts that run against a live server and database (`npx tsx scripts/test-all-apis.ts`, `test-e2e.ts`, `test-billing.ts`, …), not unit tests.

> `next.config.js` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`. A green `npm run build` does **not** mean the code typechecks — run `npx tsc --noEmit` explicitly.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Can't reach database server` | `docker compose up -d postgres`, and check `DATABASE_URL` matches `postgres:postgres@localhost:5432/postgres` |
| `PrismaClient is not configured` | Run `npx prisma generate` after any schema change |
| `STRIPE_SECRET_KEY is not configured` on `/billing` | Expected without Stripe keys. Add them per [STRIPE_SETUP.md](STRIPE_SETUP.md), or ignore |
| Map renders blank | `NEXT_PUBLIC_MAPBOX_TOKEN` missing. It is inlined at **build** time — restart `npm run dev` after setting it |
| Google/GitHub buttons missing on `/login` | OAuth providers only register when **both** the ID and secret are set |
| `EADDRINUSE :3000` / `:3001` | `lsof -ti:3000 \| xargs kill` |
| MCP server exits with `Invalid configuration` | `mcp-server/src/config.ts` validates its env with zod — check `mcp-server/.env` |

---

## 🚢 Deployment

**[📕 DEPLOYMENT.md](DEPLOYMENT.md) is the full guide.** What follows is the summary.

### How this project is actually deployed

```
push to main → GitHub Actions → docker buildx (2 images, linux/amd64)
             → private registry → kubectl set image → k3s cluster, namespace `alpha`
             → Traefik ingress + cert-manager (Let's Encrypt)
```

| Piece | Value |
|---|---|
| Cluster | Self-hosted k3s, namespace `alpha` |
| Registry | `registry.kube.nikhilbhatia.com` (private; pull secret `docker-registry-auth`) |
| App image | `registry.kube.nikhilbhatia.com/route-optimizer` → Deployment `route-optimizer`, port 3000 |
| MCP image | `registry.kube.nikhilbhatia.com/route-optimizer-mcp` → Deployment `route-optimizer-mcp`, port 3001 |
| Ingress | `traefik`, `cert-manager.io/cluster-issuer: letsencrypt` |
| Hosts | `route-optimizer.nikhilbhatia.com`, `mcp.route-optimizer.nikhilbhatia.com` |
| Probes | `/api/v1/health` (app), `/health` (MCP) |

### Continuous deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main` (and on manual dispatch with an optional `tag`). It builds and pushes both images tagged `:<sha>` and `:latest`, then `kubectl set image` + `rollout status` on both Deployments.

Required repository secrets: `REGISTRY_SERVER`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `KUBECONFIG`.

CI does **not** run lint, typecheck, tests, `kubectl apply`, or database migrations — manifest and schema changes are manual.

### Manual build and deploy

```bash
# Builds both images, pushes, and rolls both deployments
NEXT_PUBLIC_MAPBOX_TOKEN=pk.… ./k8s/build-and-push.sh registry.kube.nikhilbhatia.com/route-optimizer v1
```

Knobs: `PUSH`, `ROLLOUT`, `BUILD_APP`, `BUILD_MCP`, `PLATFORM`, `NAMESPACE` (default `alpha`).

### Applying manifests

```bash
kubectl apply -R -f k8s/app -f k8s/mcp-server
```

> Use `-R`. The manifests live in `k8s/app/` and `k8s/mcp-server/` subdirectories — a plain `kubectl apply -f k8s/` skips them and tries to apply the kubeconfig and shell script.
>
> The Deployment manifests pin `image: …:latest` while CI pins `:<sha>`, so re-applying `10-deployment.yaml` silently reverts the running image to `:latest`.

### First-time cluster bootstrap

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n alpha create secret docker-registry docker-registry-auth …
kubectl apply -f k8s/shared-config.yaml -f k8s/mcp-server/00-config.yaml   # gitignored
kubectl apply -f k8s/alpha-admin-sa.yaml                                    # CI service account
npx prisma db push                                                          # against the prod DATABASE_URL
kubectl apply -R -f k8s/app -f k8s/mcp-server
```

`k8s/shared-config.yaml`, `k8s/mcp-server/00-config.yaml` and `k8s/alpha-admin.kubeconfig` are **gitignored** — they hold the ConfigMaps and Secrets (`app-config`/`app-secrets`, `mcp-config`/`mcp-secrets`) injected via `envFrom`. Recreate them from `.env.example` on a new cluster. Full commands in [DEPLOYMENT.md §5](DEPLOYMENT.md).

### Operations

```bash
kubectl -n alpha get pods,deploy,ingress
kubectl -n alpha logs -f deploy/route-optimizer
kubectl -n alpha rollout status deploy/route-optimizer
kubectl -n alpha rollout undo deploy/route-optimizer          # rollback
kubectl -n alpha rollout restart deploy/route-optimizer       # after a ConfigMap/Secret edit
```

ConfigMap and Secret edits do not restart pods on their own — always follow with a `rollout restart`.

### Docker (standalone)

```bash
docker build --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=pk.… -t route-optimizer .

docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://… \
  -e NEXTAUTH_SECRET=… \
  -e NEXTAUTH_URL=https://your-host \
  route-optimizer
```

`NEXT_PUBLIC_MAPBOX_TOKEN` **must** be a `--build-arg`, not a runtime `-e` — Next.js inlines `NEXT_PUBLIC_*` at build time. The image is a three-stage `node:20-alpine` build producing a Next.js standalone server, running as uid 1001 with a `/api/v1/health` healthcheck.

`docker-compose.yml` is local development only: no TLS, no `DATABASE_URL` on the app service, hardcoded credentials.

### Other platforms

Nothing else is configured in this repo — no `vercel.json`, no Render/Railway/Fly config, no HPA, no Prometheus alert rules. Any platform that can run a container with `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` and the Mapbox build arg will work, but you are on your own for the Postgres and TLS story.

---

## 🔑 Environment variables

Copy `.env.example` → `.env.local`. **Required** unless noted.

### Core
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (read by Prisma) |
| `NEXTAUTH_SECRET` | Session signing secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox token — **inlined at build time** |

### Routing & traffic *(optional)*
| Variable | Default |
|---|---|
| `OSRM_SERVER_URL` | `https://router.project-osrm.org` |
| `TOMTOM_API_KEY` | — (traffic flow + incidents) |
| `MAPBOX_ACCESS_TOKEN` | Server-side fallback for the Mapbox token |

### OAuth *(optional — a provider appears only when both vars are set)*
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### Email *(optional)*
`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_PROVIDER` (default `resend`)

### Stripe *(optional — the client is built lazily, so the app runs without these)*
`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_ENTERPRISE` — see [STRIPE_SETUP.md](STRIPE_SETUP.md)

### Cache *(optional)*
| Variable | Default |
|---|---|
| `REDIS_URL` | — (falls back to in-memory only) |
| `CACHE_LOCAL_TTL` | `300` |
| `CACHE_REDIS_TTL` | `86400` |
| `CACHE_MAX_ENTRIES` | `1000` |

### Limits *(optional)*
`ENABLE_RATE_LIMIT` (`true`), `RATE_LIMIT_MAX` (`100`), `RATE_LIMIT_WINDOW_MINUTES` (`15`), `MAX_LOCATIONS` (`100`), `MAX_CABS` (`50`), `OPTIMIZATION_TIMEOUT` (`30000`), `LOG_LEVEL` (`INFO`), `APP_VERSION`

### MCP server
`MCP_API_KEYS`, `MCP_REQUIRE_AUTH`, `MCP_HTTP_PORT` (`3001`), `MCP_HTTP_HOST`, `MCP_ENABLE_CORS`, `MCP_CORS_ORIGINS`

> **Known inconsistencies:** `REDIS_URL` and the `CACHE_*` vars are read by the code but absent from `.env.example`. `src/app/api/v1/health/route.ts` reads `OSRM_URL` while every other caller uses `OSRM_SERVER_URL`. `docker-compose.yml` sets a `MAPBOX_TOKEN` that nothing reads.

---

## 🔌 API

Public endpoints under `/api/v1`, authenticated with `X-API-Key` (or `Authorization: Bearer`). Full spec in [openapi.yaml](openapi.yaml); an interactive reference lives at `/docs` in the portal.

| Endpoint | Method | Auth | Cost |
|---|---|---|---|
| `/api/v1/health` | GET | — | free |
| `/api/v1/algorithms` | GET | — | free |
| `/api/v1/metrics` | GET | — | Prometheus exposition |
| `/api/v1/optimize/route` | POST | API key | 5¢ |
| `/api/v1/optimize/multi-cluster` | POST | API key | 15¢ |
| `/api/v1/matrix/distance` | POST | API key | 2¢ |

```bash
curl -X POST https://route-optimizer.nikhilbhatia.com/api/v1/optimize/route \
  -H "X-API-Key: ropt_…" \
  -H "Content-Type: application/json" \
  -d '{"locations": [...], "options": {"algorithm": "auto"}}'
```

Requests pass through: maintenance gate (503) → API key (401) → rate limit (429, with `X-RateLimit-*` and `Retry-After`) → monthly plan quota (402, with an upgrade payload).

**Plans:** FREE 100 req/mo · TRIAL 1,000 · PRO $49/mo 10,000 · ENTERPRISE $499/mo unlimited. Limits also cap locations, cabs and which algorithms are available.

> `/api/v1/metrics` is currently **unauthenticated**, and `/api/v1/optimize` (as opposed to `/optimize/route`) is a legacy route that returns mock data.

---

## 🏗️ Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, standalone output) |
| UI | React 19, Tailwind CSS, Recharts |
| Language | TypeScript 5 |
| Database | PostgreSQL 15 + Prisma 5.22 |
| Auth | NextAuth v5 (Credentials, Google, GitHub) + API keys |
| Payments | Stripe |
| Email | Resend |
| Maps & routing | Mapbox GL JS, Mapbox Directions, OSRM, TomTom |
| Cache | In-memory L1 + Redis L2 |
| Observability | Prometheus metrics, structured JSON logging |
| Integrations | Model Context Protocol server, Telegram bot |
| Container | Docker (multi-stage, `node:20-alpine`) |
| Orchestration | Kubernetes (k3s) + Traefik + cert-manager |

---

## 📖 Documentation

| Doc | Covers |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Kubernetes deployment, CI/CD, bootstrap, operations |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [SCALABILITY_AND_INTEGRATION_GUIDE.md](SCALABILITY_AND_INTEGRATION_GUIDE.md) | Enterprise scaling and integration |
| [BUYERS_HANDOVER_GUIDE.md](BUYERS_HANDOVER_GUIDE.md) | Project handover |
| [MCP_SETUP.md](MCP_SETUP.md) | MCP server setup and Claude Desktop config |
| [STRIPE_SETUP.md](STRIPE_SETUP.md) · [STRIPE_ENV_FIX.md](STRIPE_ENV_FIX.md) | Stripe configuration and troubleshooting |
| [openapi.yaml](openapi.yaml) | Public REST API specification |
| [k8s/README.md](k8s/README.md) | Manifest notes — ⚠️ stale (says nginx; the cluster uses Traefik) |
| [QUICK_START.md](QUICK_START.md) · [server-startup-guide.md](server-startup-guide.md) | ⚠️ Superseded by the local installation section above |

---

## 📄 License

MIT. *(No `LICENSE` file is currently committed.)*

---

## 🤝 Support

1. Check the documentation table above
2. Review [openapi.yaml](openapi.yaml) or the in-app `/docs` page
3. Open a GitHub issue
