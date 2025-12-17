# 🚀 AI Transport Optimizer

A **production-ready Next.js application** for AI-powered transport route optimization with multi-algorithm support.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)

---

## ✨ Features

- 🧠 **4 AI Algorithms** - Nearest Neighbor, Christofides, Genetic Algorithm, Exhaustive Search
- 🗺️ **Interactive Mapbox Map** - Real-time visualization with route animation
- 🚗 **Multi-Cluster Optimization** - Intelligent employee grouping and cab assignment
- 📊 **Algorithm Comparison** - Auto-selects the best performing algorithm
- 🛣️ **Real Road Routing** - Via Mapbox Directions API & OSRM
- 📈 **Metrics Dashboard** - Distance, duration, efficiency, cost savings

---

## 📦 Project Structure

```
ai-transport-optimizer/
├── src/
│   ├── app/                    # Next.js pages & API routes
│   │   ├── api/                # REST API endpoints
│   │   ├── demo-ai-optimizer/  # Demo page
│   │   └── page.tsx            # Landing page
│   └── lib/
│       ├── ai-engine/          # Core algorithms (12 files)
│       ├── api/                # API middleware & validation
│       ├── cache/              # Caching layer
│       └── monitoring/         # Metrics & logging
├── public/                     # Static assets & demo files
├── k8s/                        # Kubernetes manifests
├── Dockerfile                  # Production Docker image
├── docker-compose.yml          # Local Docker setup
└── openapi.yaml               # API specification
```

---

## 🚀 Deployment Options

Choose your preferred deployment method:

### Option 1: Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ai-transport-optimizer.git
cd ai-transport-optimizer

# Copy environment template
cp .env.example .env.local

# Edit .env.local and add your Mapbox token
# Get one at: https://account.mapbox.com/access-tokens/

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

---

### Option 2: Docker (Recommended for Production)

```bash
# Build the image
docker build -t ai-transport-optimizer .

# Run the container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here \
  ai-transport-optimizer

# Or use Docker Compose (includes Redis cache)
docker-compose up -d
```

---

### Option 3: Vercel (Easiest)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Click the button above or go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Add environment variable: `NEXT_PUBLIC_MAPBOX_TOKEN`
4. Deploy!

**Manual CLI:**
```bash
npm i -g vercel
vercel
```

---

### Option 4: Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Connect to your GitHub repo on [Railway](https://railway.app)
2. Add environment variables in the dashboard
3. Railway auto-detects Next.js and deploys

---

### Option 5: Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
4. Add environment variables
5. Deploy

---

### Option 6: DigitalOcean App Platform

1. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Create App → Select GitHub repo
3. Configure as **Web Service**
4. Add environment variables
5. Deploy

---

### Option 7: AWS (ECS/Fargate)

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

docker build -t ai-transport-optimizer .
docker tag ai-transport-optimizer:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ai-transport-optimizer:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ai-transport-optimizer:latest

# Deploy via ECS/Fargate using AWS Console or CLI
```

---

### Option 8: Google Cloud Run

```bash
# Build with Cloud Build
gcloud builds submit --tag gcr.io/PROJECT_ID/ai-transport-optimizer

# Deploy to Cloud Run
gcloud run deploy ai-transport-optimizer \
  --image gcr.io/PROJECT_ID/ai-transport-optimizer \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_MAPBOX_TOKEN=your_token"
```

---

### Option 9: Azure Container Apps

```bash
# Login and create resource group
az login
az group create --name rg-optimizer --location eastus

# Create Container App environment
az containerapp env create --name optimizer-env --resource-group rg-optimizer --location eastus

# Deploy
az containerapp create \
  --name ai-transport-optimizer \
  --resource-group rg-optimizer \
  --environment optimizer-env \
  --image YOUR_ACR.azurecr.io/ai-transport-optimizer:latest \
  --target-port 3000 \
  --ingress external \
  --env-vars "NEXT_PUBLIC_MAPBOX_TOKEN=your_token"
```

---

### Option 10: Kubernetes (Self-Hosted)

Deploy using the included Kubernetes manifests:

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or individually
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
```

See `k8s/` folder for:
- `deployment.yaml` - Pod deployment configuration
- `service.yaml` - LoadBalancer/ClusterIP service
- `hpa.yaml` - Horizontal Pod Autoscaler
- `alerting-rules.yaml` - Prometheus alerting rules

---

### Option 11: Hugging Face Spaces

1. Create a new Space at [huggingface.co/new-space](https://huggingface.co/new-space)
2. Select **Docker** as SDK
3. Push your code to the Space repository
4. Add `NEXT_PUBLIC_MAPBOX_TOKEN` in Space Settings → Variables

The `README.md` YAML frontmatter is HF Spaces compatible:
```yaml
---
title: AI Transport Optimizer
emoji: 🚀
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
license: mit
---
```

---

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox API token for maps and routing | **Yes** |
| `OSRM_SERVER_URL` | Custom OSRM server URL | No |
| `TOMTOM_API_KEY` | TomTom API for traffic data | No |
| `REDIS_URL` | Redis cache URL (for distributed caching) | No |

**Get your Mapbox token:** https://account.mapbox.com/access-tokens/

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 |
| UI | React 19 + Tailwind CSS |
| Maps | Mapbox GL JS |
| Language | TypeScript |
| Routing | Mapbox Directions + OSRM |
| Container | Docker (multi-stage) |
| Orchestration | Kubernetes |

---

## 📖 Documentation

- [📘 Buyer's Handover Guide](BUYERS_HANDOVER_GUIDE.md) - Complete project handover documentation
- [📗 Scalability & Integration Guide](SCALABILITY_AND_INTEGRATION_GUIDE.md) - Enterprise scaling, API integration
- [📙 OpenAPI Specification](openapi.yaml) - Full REST API documentation

---

## 🧪 Quick Test

After deployment, verify everything works:

```bash
# Health check
curl https://your-deployment-url.com/api/v1/health

# Test optimization endpoint
curl -X POST https://your-deployment-url.com/api/v1/optimize \
  -H "Content-Type: application/json" \
  -d '{"employees": [...], "cabs": [...], "office": {...}}'
```

---

## 📄 License

MIT License - Use freely in your projects.

---

## 🤝 Support

For issues or questions:
1. Check the documentation above
2. Open a GitHub issue
3. Review the API specification in `openapi.yaml`
