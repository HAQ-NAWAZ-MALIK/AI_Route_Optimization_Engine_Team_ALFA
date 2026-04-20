# AI Transport Optimizer - Buyer's Handover Guide

## Complete Deployment, Maintenance & Operations Manual

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [System Requirements](#system-requirements)
3. [Quick Start Deployment](#quick-start-deployment)
4. [Production Deployment Options](#production-deployment-options)
5. [Configuration Guide](#configuration-guide)
6. [API Reference](#api-reference)
7. [Maintenance & Operations](#maintenance--operations)
8. [Scaling Guide](#scaling-guide)
9. [Troubleshooting](#troubleshooting)
10. [License & Support](#license--support)

---

## 🎯 Project Overview

### What is AI Transport Optimizer?

A **production-ready AI-powered route optimization platform** that reduces transport costs by up to 40% through intelligent multi-algorithm optimization.

### Key Features

| Feature | Description |
|---------|-------------|
| **5+ Algorithms** | Christofides, Genetic, Nearest Neighbor, Exhaustive, Auto-Select |
| **Multi-Cluster** | Optimize entire fleets with automatic employee clustering |
| **Real-Road Routing** | OSRM/Mapbox integration for actual road networks |
| **Traffic Awareness** | TomTom API integration (optional) |
| **API-First** | RESTful API with OpenAPI 3.1 specification |
| **Enterprise Ready** | Docker, Kubernetes, health checks, monitoring |

### Tech Stack

- **Framework**: Next.js 14 (TypeScript)
- **Styling**: TailwindCSS
- **Container**: Docker (Node 20 Alpine)
- **Orchestration**: Kubernetes
- **Caching**: Redis (optional)

---

## 💻 System Requirements

### Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4+ GB |
| Storage | 1 GB | 5 GB |
| Node.js | 18+ | 20+ |

### Required Services

- **Mapbox Account** (Free tier available) - For real-road routing
- **Redis** (Optional) - For distributed caching

---

## 🚀 Quick Start Deployment

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd ai-transport-optimizer

# 2. Create environment file
cp .env.example .env.local

# 3. Add your Mapbox token to .env.local
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here

# 4. Build and run
docker-compose up -d --build

# 5. Access the application
# Landing page: http://localhost:3000/landing.html
# Demo app: http://localhost:3000
# API: http://localhost:3000/api/v1/health
```

### Option 2: Direct Node.js

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local
# Edit .env.local with your Mapbox token

# 3. Build for production
npm run build

# 4. Start production server
npm start
```

---

## 🏭 Production Deployment Options

### A. Docker Deployment

**Build Docker Image:**
```bash
docker build -t ai-transport-optimizer:latest .
```

**Run Container:**
```bash
docker run -d \
  --name optimizer \
  -p 3000:3000 \
  -e NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token \
  ai-transport-optimizer:latest
```

### B. Docker Compose with Redis

```bash
# Uses docker-compose.yml in project root
docker-compose up -d

# Services started:
# - optimizer: Port 3000
# - redis: Port 6379
```

### C. Kubernetes Deployment

```bash
# 1. Create namespace
kubectl create namespace transport-optimizer

# 2. Create secrets
kubectl create secret generic optimizer-secrets \
  --from-literal=MAPBOX_TOKEN=pk.your_token \
  -n transport-optimizer

# 3. Apply manifests
kubectl apply -f k8s/ -n transport-optimizer

# Files applied:
# - deployment.yaml  (Application deployment)
# - service.yaml     (LoadBalancer service)
# - hpa.yaml         (Horizontal Pod Autoscaler)
# - alerting-rules.yaml (Prometheus alerts)
```

### D. Cloud Platform Deployment

#### Vercel (Serverless)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

#### Railway
```bash
# Connect GitHub repo to Railway
# Set environment variables in Railway dashboard
# Auto-deploys on push
```

#### AWS EC2 / GCP Compute / Azure VM
1. Provision VM (Ubuntu 22.04 recommended)
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Clone repo and run `docker-compose up -d`
4. Configure reverse proxy (Nginx/Caddy) for SSL

---

## ⚙️ Configuration Guide

### Environment Variables

Create `.env.local` or set in your deployment platform:

```env
# ========================================
# REQUIRED
# ========================================
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91...

# ========================================
# OPTIONAL
# ========================================
# TomTom Traffic API
TOMTOM_API_KEY=your_tomtom_key

# Redis Caching (for distributed deployments)
REDIS_URL=redis://localhost:6379

# Cache Settings
CACHE_LOCAL_TTL=300          # 5 minutes
CACHE_REDIS_TTL=86400        # 24 hours
CACHE_MAX_ENTRIES=1000

# Port Configuration
PORT=3000

# OSRM Fallback (if Mapbox fails)
OSRM_SERVER_URL=https://router.project-osrm.org
```

### API Keys Setup

#### Mapbox (Required)
1. Sign up at [mapbox.com](https://account.mapbox.com/)
2. Navigate to Access Tokens
3. Copy the default public token (`pk.xxxxx`)
4. Add to `.env.local`

#### TomTom (Optional - for traffic data)
1. Sign up at [developer.tomtom.com](https://developer.tomtom.com/)
2. Create a new API key
3. Add to `.env.local`

---

## 📡 API Reference

### Base URL
```
Production: https://your-domain.com/api/v1
Local: http://localhost:3000/api/v1
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/algorithms` | List available algorithms |
| POST | `/optimize/route` | Optimize single route |
| POST | `/optimize/multi-cluster` | Optimize multiple cabs |
| POST | `/matrix/distance` | Calculate distance matrix |

### Authentication

Use API keys in headers:
```
X-API-Key: demo_pro_key_67890
```

**Built-in Demo Keys:**
- `demo_free_key_12345` - 100 req/day
- `demo_pro_key_67890` - 1000 req/day
- `demo_enterprise_key_abcde` - Unlimited

### Example: Optimize Route

```bash
curl -X POST http://localhost:3000/api/v1/optimize/route \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo_pro_key_67890" \
  -d '{
    "origin": {"id": "office", "lat": 34.05, "lng": -118.24},
    "destinations": [
      {"id": "emp1", "lat": 34.06, "lng": -118.30},
      {"id": "emp2", "lat": 34.08, "lng": -118.28}
    ],
    "constraints": {"departureTime": "08:00"},
    "options": {"algorithm": "auto"}
  }'
```

### OpenAPI Specification

Full API documentation available at:
- **YAML**: `/openapi.yaml`
- **Interactive**: Import to Swagger UI or Postman

---

## 🔧 Maintenance & Operations

### Health Monitoring

**Health Check Endpoint:**
```bash
curl http://localhost:3000/api/v1/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 86400,
  "services": {
    "optimizer": true,
    "osrm": true
  }
}
```

### Logs

**Docker:**
```bash
docker logs -f optimizer
```

**Docker Compose:**
```bash
docker-compose logs -f optimizer
```

**Kubernetes:**
```bash
kubectl logs -f deployment/optimizer -n transport-optimizer
```

### Database/Storage

- **No database required** - Stateless application
- Route calculations are computed on-demand
- Redis cache is optional for performance

### Backup Strategy

Minimal backup required since app is stateless:
1. **Code**: Keep in Git repository
2. **Environment**: Backup `.env` files securely
3. **Redis** (if used): Standard Redis backup

### Updates

```bash
# Docker
docker-compose down
git pull
docker-compose up -d --build

# Kubernetes
kubectl set image deployment/optimizer optimizer=your-image:new-tag
```

---

## 📈 Scaling Guide

### Horizontal Scaling

**Docker Compose:**
```bash
docker-compose up -d --scale optimizer=3
```

**Kubernetes HPA Configuration** (already included):
```yaml
# k8s/hpa.yaml
minReplicas: 2
maxReplicas: 10
targetCPUUtilization: 70%
```

### Performance Benchmarks

| Destinations | Algorithm | Response Time |
|--------------|-----------|---------------|
| 10 | Auto | < 100ms |
| 50 | Christofides | < 500ms |
| 100 | Genetic | < 2s |
| 500 | Nearest Neighbor | < 5s |

### Caching Strategy

Enable Redis for multi-instance deployments:
```env
REDIS_URL=redis://your-redis:6379
CACHE_REDIS_TTL=86400
```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. "Mapbox token not found"
```bash
# Check environment variable
echo $NEXT_PUBLIC_MAPBOX_TOKEN

# Ensure it starts with "pk."
```

#### 2. Container won't start
```bash
# Check logs
docker logs optimizer

# Verify port availability
netstat -tlnp | grep 3000
```

#### 3. Routes not using real roads
- Verify Mapbox token is valid
- Check OSRM_SERVER_URL fallback is configured

#### 4. High memory usage
- Enable Redis caching
- Limit max destinations per request

### Support Checklist

- [ ] Mapbox token configured?
- [ ] Port 3000 available?
- [ ] Health check passing?
- [ ] Logs show no errors?

---

## 📜 License & Support

### License

MIT License - Commercial use permitted

### Files Included

```
ai-transport-optimizer/
├── src/                    # Application source code
├── public/                 # Static assets & landing page
├── k8s/                    # Kubernetes manifests
├── Dockerfile              # Production Docker image
├── docker-compose.yml      # Docker Compose config
├── openapi.yaml            # API specification
├── package.json            # Dependencies
└── README.md               # Quick start guide
```

### Technical Contact

For technical questions:
- Review `SCALABILITY_AND_INTEGRATION_GUIDE.md`
- Check `openapi.yaml` for API details
- Examine `src/lib/` for core algorithms

---

## ✅ Deployment Checklist

Before going live:

- [ ] Mapbox API token configured
- [ ] Environment variables set
- [ ] Health check endpoint responding
- [ ] SSL/HTTPS configured (production)
- [ ] Domain DNS configured
- [ ] Monitoring/alerting setup (optional)
- [ ] Backup strategy documented
- [ ] Team trained on basic operations

---

**Document Version**: 1.0  
**Last Updated**: December 2025

