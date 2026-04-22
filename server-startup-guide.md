# AI Transport Optimizer - Complete Server Startup Guide

## 📋 Overview

This guide covers the proper startup sequence for all components of the AI Transport Optimizer application.

## 🔧 Prerequisites

Before starting, ensure you have:
- ✅ Node.js 18+ installed
- ✅ Docker installed (for PostgreSQL)
- ✅ All dependencies installed: `npm install`
- ✅ Environment variables configured in `.env`

---

## 🚀 Startup Sequence

### Step 1: Start PostgreSQL Database

The database must be started **first** before the main application.

#### Option A: Using Docker (Recommended)

```powershell
# Start existing container (if already created)
docker start transport-optimizer-db

# OR create new container (first time only)
docker run --name transport-optimizer-db `
  -e POSTGRES_PASSWORD=password `
  -e POSTGRES_USER=user `
  -e POSTGRES_DB=transport_optimizer `
  -p 5432:5432 `
  -d postgres:15-alpine
```

#### Option B: Using Docker Compose

```powershell
docker-compose up -d
```

#### Verify Database is Running

```powershell
# Check container status
docker ps | findstr transport-optimizer-db

# Expected output:
# <container_id>   postgres:15-alpine   ...   Up X minutes   5432/tcp
```

---

### Step 2: Push Database Schema (First Time Only)

After starting the database, push the Prisma schema:

```powershell
npx prisma db push
```

**Expected Output:**
```
✔ Schema pushed successfully
Database is in sync with Prisma schema
```

---

### Step 3: Start Main Application Server

The main Next.js application includes the optimization engine and API endpoints.

```powershell
npm run dev
```

**What This Starts:**
- ✅ Next.js application server
- ✅ Route optimization engine (AI algorithms)
- ✅ Portal dashboard & authentication
- ✅ API endpoints (`/api/v1/*`)
- ✅ Public demo pages

**Expected Output:**
```
▲ Next.js 15.5.9
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Starting...
✓ Ready in 2.5s
```

**Verify Main Server:**
- Open: http://localhost:3000
- Check health: http://localhost:3000/api/v1/health

---

### Step 4: Start MCP Server (Optional)

The MCP (Model Context Protocol) server enables AI assistants like Claude to use the optimizer.

#### Option A: HTTP Mode (Recommended for Testing)

```powershell
npm run mcp:http
```

**Expected Output:**
```
[INFO] MCP Server running
- POST http://localhost:3001/mcp
- POST http://localhost:3001/api/tools
```

#### Option B: STDIO Mode (for Claude Desktop Integration)

```powershell
npm run mcp:dev
```

**What MCP Server Provides:**
- ✅ Route optimization tools for AI assistants
- ✅ Multi-cluster optimization
- ✅ Distance matrix calculations

**Verify MCP Server:**
- HTTP endpoint: http://localhost:3001/mcp
- Check with: `curl http://localhost:3001/mcp`

---

## 📊 Full Startup Summary

In **three separate terminal windows**, run:

### Terminal 1: Database
```powershell
docker start transport-optimizer-db
```

### Terminal 2: Main Application
```powershell
cd c:\Users\ACER\Downloads\ai-transport-optimizer-v3-mcp
npm run dev
```

### Terminal 3: MCP Server
```powershell
cd c:\Users\ACER\Downloads\ai-transport-optimizer-v3-mcp
npm run mcp:http
```

---

## ✅ Verification Checklist

After all services are running, verify:

| Service | URL | Expected Response |
|---------|-----|-------------------|
| **Main App** | http://localhost:3000 | Homepage loads |
| **API Health** | http://localhost:3000/api/v1/health | `{"status": "ok"}` |
| **Portal Dashboard** | http://localhost:3000/dashboard | Login/Signup page |
| **API Demo** | http://localhost:3000/api-demo.html | Demo interface |
| **MCP Server** | http://localhost:3001/mcp | MCP response |
| **Database** | `docker ps` | Container `transport-optimizer-db` Up |

---

## 🛑 Stopping the Servers

### Stop Main Application
In Terminal 2: Press `Ctrl + C`

### Stop MCP Server
In Terminal 3: Press `Ctrl + C`

### Stop Database
```powershell
docker stop transport-optimizer-db
```

### Stop All (Nuclear Option)
```powershell
# Stop all running node processes
Stop-Process -Name node -Force

# Stop database
docker stop transport-optimizer-db
```

---

## 🔍 Troubleshooting

### Database Won't Start

**Error:** `port 5432 already in use`

**Solution:**
```powershell
# Find and stop process using port 5432
netstat -ano | findstr :5432
# Note the PID, then:
Stop-Process -Id <PID> -Force

# Or use a different port in .env:
# DATABASE_URL="postgresql://user:password@localhost:5433/transport_optimizer"
docker run ... -p 5433:5432 ...
```

---

### Main Server Won't Start

**Error:** `EADDRINUSE: port 3000 already in use`

**Solution:**
```powershell
# Kill process on port 3000
netstat -ano | findstr :3000
Stop-Process -Id <PID> -Force
```

---

### Database Connection Failed

**Error:** `Can't reach database server at localhost:5432`

**Solution:**
```powershell
# Check database is running
docker ps

# Restart database
docker restart transport-optimizer-db

# Wait 5 seconds, then retry
npx prisma db push
```

---

### MCP Server Port Conflict

**Error:** `port 3001 already in use`

**Solution:**
```powershell
# Kill process on port 3001
netstat -ano | findstr :3001
Stop-Process -Id <PID> -Force
```

---

## 📝 Environment Variables Reference

Key variables in your `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/transport_optimizer"

# Main Application
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# MCP Server
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=localhost
MCP_API_KEYS="mcp_key_1,mcp_key_2"

# Optional: Maps
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1..."
TOMTOM_API_KEY="your-tomtom-key"
```

---

## 🎯 Quick Start Commands

### Development (All Services)

```powershell
# Terminal 1
docker start transport-optimizer-db

# Terminal 2
npm run dev

# Terminal 3
npm run mcp:http
```

### Production Build

```powershell
# Build application
npm run build

# Start production server
npm start
```

---

## 📚 What Each Service Does

### 1. **PostgreSQL Database**
- Stores user accounts, API keys, subscriptions
- Tracks usage logs and analytics
- Required for portal authentication & billing

### 2. **Main Application (Next.js)**
- **Frontend:** Portal dashboard, API demo pages
- **Backend:** REST API endpoints for optimization
- **Engine:** AI route optimization algorithms
  - Nearest Neighbor
  - Christofides Algorithm
  - Genetic Algorithm
  - Exhaustive Search

### 3. **MCP Server**
- Exposes optimization tools to AI assistants
- HTTP or STDIO communication
- Optional for main app functionality

---

## ✨ First-Time Setup Checklist

- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Copy `.env.example` to `.env`
- [ ] Configure environment variables
- [ ] Start PostgreSQL: `docker start transport-optimizer-db`
- [ ] Push schema: `npx prisma db push`
- [ ] Start app: `npm run dev`
- [ ] Create admin account at http://localhost:3000
- [ ] Generate API key in portal
- [ ] Test API at http://localhost:3000/api-demo.html

---

## 🎉 You're All Set!

Your AI Transport Optimizer is now fully operational with:
- ✅ Database for data persistence
- ✅ Main application with optimization engine
- ✅ MCP server for AI assistant integration
- ✅ Portal for user & API key management
