# AI Transport Optimizer - Complete Architecture Guide

> **Comprehensive technical documentation covering the entire system architecture, AI engine, Next.js application, MCP server, APIs, authentication, database, and user flows.**

---

## 📑 Table of Contents

1. [System Overview](#system-overview)
2. [Repository Structure](#repository-structure)
3. [AI Optimization Engine](#ai-optimization-engine)
4. [Next.js Application Architecture](#nextjs-application-architecture)
5. [API Layer](#api-layer)
6. [MCP Server](#mcp-server)
7. [Database Schema](#database-schema)
8. [Authentication & Authorization](#authentication--authorization)
9. [User Flows](#user-flows)
10. [Admin Flows](#admin-flows)
11. [Data Flow Diagrams](#data-flow-diagrams)
12. [Integration Points](#integration-points)

---

## 1. System Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        AI[AI Assistants<br/>Claude/ChatGPT]
    end

    subgraph "Next.js Application :3000"
        PORTAL[Portal Dashboard<br/>React Components]
        API[REST API<br/>/api/v1/*]
        AUTH[NextAuth.js<br/>Authentication]
        ENGINE[AI Optimization Engine<br/>TypeScript]
    end

    subgraph "MCP Server :3001"
        MCP_HTTP[HTTP Server]
        MCP_TOOLS[Optimization Tools]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Database)]
        CACHE[In-Memory Cache]
    end

    subgraph "External APIs"
        OSRM[OSRM<br/>Routing]
        MAPBOX[Mapbox<br/>Maps]
        TOMTOM[TomTom<br/>Traffic]
        STRIPE[Stripe<br/>Billing]
    end

    WEB --> PORTAL
    WEB --> API
    AI --> MCP_HTTP
    
    PORTAL --> AUTH
    PORTAL --> API
    API --> ENGINE
    API --> PG
    API --> CACHE
    
    MCP_HTTP --> MCP_TOOLS
    MCP_TOOLS --> API
    
    ENGINE --> OSRM
    ENGINE --> TOMTOM
    PORTAL --> MAPBOX
    API --> STRIPE
    AUTH --> PG
```

### Core Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | Next.js 15 + React 19 | Portal dashboard, admin panel |
| **Backend** | Next.js API Routes | REST API endpoints |
| **AI Engine** | TypeScript | Route optimization algorithms |
| **Database** | PostgreSQL + Prisma | User data, API keys, billing |
| **Authentication** | NextAuth.js v5 | User auth, sessions, OAuth |
| **MCP Server** | Express.js | AI assistant integration |
| **Caching** | In-Memory | Performance optimization |
| **Maps** | OSRM + Mapbox | Routing and visualization |
| **Billing** | Stripe | Subscription management |

---

## 2. Repository Structure

### Directory Organization

```
ai-transport-optimizer-v3-mcp/
├── src/                          # Next.js application
│   ├── app/                      # App Router pages & API routes
│   │   ├── (auth)/              # Authentication pages
│   │   ├── (portal)/            # Portal dashboard pages
│   │   ├── admin/               # Admin panel pages
│   │   └── api/                 # API endpoints
│   │       ├── v1/              # Versioned API
│   │       ├── auth/            # Auth endpoints
│   │       ├── portal/          # Portal API
│   │       └── admin/           # Admin API
│   ├── lib/                     # Core libraries
│   │   ├── ai-engine/           # ⭐ Optimization algorithms
│   │   ├── auth/                # Auth utilities
│   │   ├── api/                 # API helpers
│   │   ├── api-keys/            # API key management
│   │   ├── billing/             # Stripe integration
│   │   └── db/                  # Database client
│   ├── components/              # React components
│   │   ├── ui/                  # Reusable UI components
│   │   └── portal/              # Portal-specific components
│   └── middleware.ts            # Route middleware
│
├── mcp-server/                  # MCP Server
│   └── src/
│       ├── index.ts             # STDIO server
│       ├── http-server.ts       # HTTP server
│       ├── tools/               # MCP tools
│       └── schemas/             # Validation schemas
│
├── prisma/
│   └── schema.prisma            # Database schema
│
├── public/                      # Static files
│   ├── demo.html               # Demo app
│   └── api-demo.html           # API testing interface
│
└── scripts/                     # Utility scripts
```

### Key File Purposes

| File/Directory | Purpose |
|----------------|---------|
| `src/lib/ai-engine/` | All optimization algorithms and logic |
| `src/app/api/v1/` | Public API endpoints for optimization |
| `src/app/(portal)/` | Portal dashboard UI |
| `src/app/admin/` | Admin panel UI |
| `mcp-server/src/` | MCP protocol server for AI assistants |
| `prisma/schema.prisma` | Database models and relationships |

---

## 3. AI Optimization Engine

### Engine Architecture

```mermaid
graph LR
    subgraph "AI Engine Core"
        ROUTER[Enhanced Route<br/>Optimizer]
        
        subgraph "Algorithms"
            CHRIS[TSP Christofides<br/>1.5x optimal]
            GENETIC[Genetic Algorithm<br/>Complex routes]
            EXHAUST[Exhaustive Search<br/>Small sets]
            NN[Nearest Neighbor<br/>Fast heuristic]
        end
        
        subgraph "Integrations"
            OSRM_INT[OSRM Client<br/>Real roads]
            TRAFFIC[Traffic API<br/>Live conditions]
            TIME[Time Window<br/>Solver]
        end
        
        subgraph "Multi-Cluster"
            CAB_DIST[Cab Distribution<br/>Clustering]
            ANALYZER[Distribution<br/>Analyzer]
        end
    end
    
    ROUTER --> CHRIS
    ROUTER --> GENETIC
    ROUTER --> EXHAUST
    ROUTER --> NN
    
    ROUTER --> OSRM_INT
    ROUTER --> TRAFFIC
    ROUTER --> TIME
    
    CAB_DIST --> ROUTER
    ANALYZER --> CAB_DIST
```

### Algorithm Selection Logic

```mermaid
flowchart TD
    START[Optimization Request] --> COUNT{Location Count?}
    
    COUNT -->|<= 10| EXHAUST[Exhaustive Search<br/>Test all permutations]
    COUNT -->|11-20| CHRIS[TSP Christofides<br/>1.5x guarantee]
    COUNT -->|21-50| GENETIC[Genetic Algorithm<br/>Evolutionary]
    COUNT -->|>50| NN[Nearest Neighbor<br/>+ 2-Opt]
    
    EXHAUST --> OSRM{Use Real Roads?}
    CHRIS --> OSRM
    GENETIC --> OSRM
    NN --> OSRM
    
    OSRM -->|Yes| OSRM_CALC[OSRM Route<br/>Calculation]
    OSRM -->|No| HAVERSINE[Haversine<br/>Distance]
    
    OSRM_CALC --> TRAFFIC{Traffic Enabled?}
    HAVERSINE --> RESULT
    
    TRAFFIC -->|Yes| TOMTOM[TomTom API<br/>Adjustments]
    TRAFFIC -->|No| RESULT[Optimized Route]
    
    TOMTOM --> RESULT
```

### Core Engine Files

```
src/lib/ai-engine/
├── index.ts                         # Main exports
├── types.ts                        # TypeScript definitions
│
├── enhanced-route-optimizer.ts     # ⭐ Main optimizer entry point
├── tsp-christofides.ts             # Christofides algorithm
├── genetic-algorithm.ts            # Genetic algorithm
├── exhaustive-testing.ts           # Exhaustive search
│
├── osrm-client.ts                  # OSRM API integration
├── mapbox-directions.ts            # Mapbox Directions API
├── traffic-integration.ts          # TomTom Traffic API
├── time-window-solver.ts           # Time constraint handling
│
├── cab-distribution.ts             # Vehicle assignment
└── distribution-analyzer.ts        # Multi-cluster analysis
```

### Algorithm Details

#### 1. TSP Christofides Algorithm

**File:** `tsp-christofides.ts`

**Purpose:** Provides 1.5x optimal guarantee for TSP

**Process:**
1. Build Minimum Spanning Tree (MST)
2. Find odd-degree vertices
3. Compute minimum-weight perfect matching
4. Create Eulerian circuit
5. Apply 2-Opt improvements

**Complexity:** O(n³)

#### 2. Genetic Algorithm

**File:** `genetic-algorithm.ts`

**Purpose:** Handle complex routes with 20+ locations

**Parameters:**
- Population: 50 individuals
- Generations: 100
- Mutation Rate: 0.15
- Elite Retention: Top 10%

**Operators:**
- Selection: Tournament
- Crossover: Order Crossover (OX)
- Mutation: Swap mutation

#### 3. Multi-Cluster Optimization

**File:** `cab-distribution.ts` + `distribution-analyzer.ts`

**Process:**
```mermaid
flowchart TD
    EMPLOYEES[Employee Locations] --> CLUSTER[Clustering<br/>K-Means]
    CABS[Available Cabs] --> CLUSTER
    
    CLUSTER --> ASSIGN[Cab Assignment<br/>Capacity-aware]
    
    ASSIGN --> ROUTE1[Route Optimization<br/>Cab 1]
    ASSIGN --> ROUTE2[Route Optimization<br/>Cab 2]
    ASSIGN --> ROUTEN[Route Optimization<br/>Cab N]
    
    ROUTE1 --> ANALYZE[Distribution<br/>Analyzer]
    ROUTE2 --> ANALYZE
    ROUTEN --> ANALYZE
    
    ANALYZE --> RESULT[Optimized<br/>Multi-Cluster Routes]
```

**Features:**
- Geographic clustering
- Capacity constraints
- Workload balancing
- Cost optimization

---

## 4. Next.js Application Architecture

### App Router Structure

```mermaid
graph TD
    subgraph "Public Routes"
        HOME[/ - Landing Page]
        DEMO[/demo-ai-optimizer - Demo]
    end

    subgraph "Auth Routes (auth)"
        LOGIN[/login]
        SIGNUP[/signup]
        VERIFY[/verify-email]
    end

    subgraph "Portal Routes (portal)"
        DASH[/dashboard - Overview]
        API_KEYS[/api-keys - Key Management]
        USAGE[/usage - Usage Stats]
        BILLING[/billing - Subscription]
        SETTINGS[/settings - User Settings]
    end

    subgraph "Admin Routes"
        ADMIN_DASH[/admin/dashboard]
        ADMIN_USERS[/admin/users]
        ADMIN_KEYS[/admin/api-keys]
        ADMIN_ANALYTICS[/admin/analytics]
        ADMIN_AUDIT[/admin/audit]
    end

    subgraph "API Routes"
        API_V1[/api/v1/* - Public API]
        API_AUTH[/api/auth/* - NextAuth]
        API_PORTAL[/api/portal/* - Portal API]
        API_ADMIN[/api/admin/* - Admin API]
    end
```

### Component Architecture

```
src/components/
├── ui/                          # Shadcn UI components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
│
└── portal/                      # Portal-specific
    ├── layout/
    │   ├── portal-layout.tsx    # Main layout wrapper
    │   └── sidebar.tsx          # Navigation sidebar
    │
    ├── dashboard/
    │   ├── stats-card.tsx       # Metrics display
    │   └── usage-chart.tsx      # Charts
    │
    ├── api-keys/
    │   ├── create-key-modal.tsx
    │   ├── key-display.tsx
    │   └── key-list.tsx
    │
    └── billing/
        ├── plan-card.tsx
        └── payment-form.tsx
```

### Middleware Flow

```mermaid
flowchart LR
    REQ[HTTP Request] --> MIDDLEWARE[middleware.ts]
    
    MIDDLEWARE --> AUTH_CHECK{Authenticated?}
    
    AUTH_CHECK -->|No + Protected| REDIRECT[Redirect to /login]
    AUTH_CHECK -->|Yes| ROLE_CHECK{Route Requires?}
    
    ROLE_CHECK -->|Admin| ADMIN_CHECK{Is Admin?}
    ROLE_CHECK -->|User| ALLOW[Allow Access]
    ROLE_CHECK -->|Public| ALLOW
    
    ADMIN_CHECK -->|Yes| ALLOW
    ADMIN_CHECK -->|No| DENY[403 Forbidden]
    
    REDIRECT --> END[Response]
    ALLOW --> END
    DENY --> END
```

**File:** `src/middleware.ts`

**Protected Routes:**
- `/dashboard/*` - Requires authentication
- `/admin/*` - Requires admin role
- `/api-keys/*` - Requires authentication
- `/billing/*` - Requires authentication

---

## 5. API Layer

### API Endpoint Structure

```mermaid
graph TB
    subgraph "Public API /api/v1"
        HEALTH[/health - Status]
        
        ROUTE[/optimize/route - Single Route]
        MULTI[/optimize/multi-cluster - Multi-Cab]
        
        MATRIX[/matrix/distance - Distance Matrix]
        
        ALGOS[/algorithms - List Algorithms]
        METRICS[/metrics - System Metrics]
    end

    subgraph "Portal API /api/portal"
        KEYS[/keys - API Key CRUD]
        USAGE_API[/usage - Usage Stats]
        STATS[/stats - Dashboard Stats]
    end

    subgraph "Admin API /api/admin"
        USERS[/users - User Management]
        ADMIN_KEYS[/api-keys - All Keys]
        ANALYTICS[/analytics - System Analytics]
        AUDIT[/audit - Audit Logs]
        CONFIG[/config - System Config]
    end

    subgraph "Auth API /api/auth"
        LOGIN_API[/signin - Login]
        SIGNUP_API[/signup - Register]
        SESSION[/session - Current Session]
    end
```

### API Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant APIRoute
    participant AuthCheck
    participant RateLimit
    participant Engine
    participant Database

    Client->>+Middleware: POST /api/v1/optimize/route
    Middleware->>+AuthCheck: Validate API Key
    AuthCheck->>+Database: Find API Key
    Database-->>-AuthCheck: Key Details
    AuthCheck-->>-Middleware: Valid ✓
    
    Middleware->>+RateLimit: Check Rate Limit
    RateLimit->>+Database: Get Usage Count
    Database-->>-RateLimit: Count
    RateLimit-->>-Middleware: OK ✓
    
    Middleware->>+APIRoute: Process Request
    APIRoute->>+Engine: optimizeRoute(data)
    Engine-->>-APIRoute: Optimized Route
    
    APIRoute->>+Database: Log Usage
    Database-->>-APIRoute: Logged
    
    APIRoute-->>-Client: Response
```

### API Authentication

All `/api/v1/*` endpoints require **API Key** via header:

```http
X-API-Key: ropt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Rate Limiting:**
- Default: 100 requests / 15 minutes
- Configurable per API key
- Tracked in database

---

## 6. MCP Server

### MCP Architecture

```mermaid
graph TB
    subgraph "AI Assistants"
        CLAUDE[Claude Desktop]
        CHATGPT[ChatGPT]
        CUSTOM[Custom Clients]
    end

    subgraph "MCP Server :3001"
        HTTP[HTTP Server<br/>Express.js]
        STDIO[STDIO Server<br/>stdio transport]
        
        TOOLS[MCP Tools]
        SCHEMAS[Zod Schemas]
        
        subgraph "Available Tools"
            TOOL1[optimize_route]
            TOOL2[optimize_multi_cluster]
            TOOL3[calculate_distance_matrix]
        end
    end

    subgraph "Main App API"
        API_V1[/api/v1/*<br/>Endpoints]
    end

    CLAUDE -.STDIO.-> STDIO
    CHATGPT -.HTTP.-> HTTP
    CUSTOM -.HTTP.-> HTTP
    
    HTTP --> TOOLS
    STDIO --> TOOLS
    
    TOOLS --> TOOL1
    TOOLS --> TOOL2
    TOOLS --> TOOL3
    
    TOOL1 --> API_V1
    TOOL2 --> API_V1
    TOOL3 --> API_V1
```

### MCP Server Files

```
mcp-server/src/
├── index.ts              # STDIO server (Claude Desktop)
├── http-server.ts        # HTTP server (web clients)
├── config.ts             # Configuration
├── logger.ts             # Logging
├── errors.ts             # Error handling
│
├── tools/
│   └── ai-engine-handlers.ts   # Tool implementations
│
└── schemas/
    └── validation.ts            # Input validation
```

### MCP Tool Definitions

#### 1. optimize_route

**Description:** Optimize a single route for one vehicle

**Input Schema:**
```typescript
{
  origin: Location,
  destinations: Location[],
  tripType: "pickup" | "dropoff",
  options?: {
    algorithm?: "auto" | "nearest_neighbor" | "christofides" | "genetic",
    useRealRoads?: boolean,
    considerTraffic?: boolean
  }
}
```

**Output:** Optimized route with stops, distance, duration

#### 2. optimize_multi_cluster

**Description:** Optimize routes for multiple vehicles

**Input Schema:**
```typescript
{
  employees: Location[],
  office: Location,
  cabs: Array<{id: string, capacity: number}>,
  tripType: "pickup" | "dropoff"
}
```

**Output:** Multiple optimized routes with cab assignments

#### 3. calculate_distance_matrix

**Description:** Calculate distance/duration matrix

**Input Schema:**
```typescript
{
  coordinates: Array<{lat: number, lng: number}>
}
```

**Output:** Distance and duration matrices

---

## 7. Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ API_KEY : creates
    USER ||--o{ SUBSCRIPTION : has
    USER ||--o{ USAGE_LOG : generates
    USER ||--o{ INVOICE : receives
    USER ||--o{ AUDIT_LOG : performs
    USER ||--o{ ACCOUNT : has
    USER ||--o{ SESSION : has
    
    API_KEY ||--o{ USAGE_LOG : tracks
    
    USER {
        string id PK
        string email UK
        string name
        string password
        UserRole role
        datetime createdAt
    }
    
    API_KEY {
        string id PK
        string userId FK
        string name
        string keyHash UK
        string prefix
        string[] permissions
        int rateLimit
        datetime lastUsedAt
        datetime expiresAt
    }
    
    SUBSCRIPTION {
        string id PK
        string userId FK
        SubscriptionPlan plan
        SubscriptionStatus status
        string stripeCustomerId UK
        string stripeSubscriptionId UK
        datetime currentPeriodEnd
    }
    
    USAGE_LOG {
        string id PK
        string apiKeyId FK
        string userId FK
        string endpoint
        int statusCode
        int responseTime
        json metadata
        datetime timestamp
    }
    
    INVOICE {
        string id PK
        string userId FK
        int amount
        InvoiceStatus status
        string stripeInvoiceId UK
        datetime paidAt
    }
    
    AUDIT_LOG {
        string id PK
        string userId FK
        string action
        json details
        string ipAddress
        datetime timestamp
    }
    
    ACCOUNT {
        string id PK
        string userId FK
        string provider
        string providerAccountId
    }
    
    SESSION {
        string id PK
        string userId FK
        string sessionToken UK
        datetime expires
    }
```

### Key Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **users** | User accounts | email, role, password |
| **api_keys** | API authentication | keyHash, permissions, rateLimit |
| **subscriptions** | Billing plans | plan, status, stripeCustomerId |
| **usage_logs** | API usage tracking | endpoint, responseTime, metadata |
| **invoices** | Payment records | amount, status, stripeInvoiceId |
| **audit_logs** | Admin activity | action, details, ipAddress |

---

## 8. Authentication & Authorization

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant Database

    User->>+Browser: Enter credentials
    Browser->>+NextAuth: POST /api/auth/signin
    NextAuth->>+Database: Find user by email
    Database-->>-NextAuth: User record
    
    NextAuth->>NextAuth: Verify password<br/>(bcrypt)
    
    alt Valid Credentials
        NextAuth->>+Database: Create session
        Database-->>-NextAuth: Session token
        NextAuth-->>Browser: Set session cookie
        Browser-->>User: Redirect to /dashboard
    else Invalid Credentials
        NextAuth-->>Browser: Error: Invalid credentials
        Browser-->>User: Show error
    end
```

### Role-Based Access Control

```mermaid
flowchart TD
    REQUEST[Incoming Request] --> AUTH{Authenticated?}
    
    AUTH -->|No| PUBLIC{Public Route?}
    AUTH -->|Yes| ROLE{User Role?}
    
    PUBLIC -->|Yes| ALLOW[✓ Allow]
    PUBLIC -->|No| DENY[✗ Redirect to Login]
    
    ROLE -->|USER| USER_ROUTES{Portal Route?}
    ROLE -->|ADMIN| ADMIN_ROUTES{Admin Route?}
    
    USER_ROUTES -->|/dashboard/*| ALLOW
    USER_ROUTES -->|/api-keys/*| ALLOW
    USER_ROUTES -->|/billing/*| ALLOW
    USER_ROUTES -->|/admin/*| DENY
    
    ADMIN_ROUTES -->|/dashboard/*| ALLOW
    ADMIN_ROUTES -->|/api-keys/*| ALLOW
    ADMIN_ROUTES -->|/admin/*| ALLOW
```

**Roles:**
- `USER` - Regular users, access to portal
- `ADMIN` - Administrators, access to admin panel + portal

**Protected Routes:**
```typescript
// middleware.ts
const protectedRoutes = [
  '/dashboard',
  '/api-keys',
  '/billing',
  '/usage',
  '/settings'
];

const adminRoutes = [
  '/admin'
];
```

---

## 9. User Flows

### User Registration & Onboarding

```mermaid
flowchart TD
    START[Visit Website] --> CLICK[Click Sign Up]
    CLICK --> FORM[Fill Registration Form<br/>Email, Password, Name]
    
    FORM --> SUBMIT[Submit Form]
    SUBMIT --> VALIDATE{Valid?}
    
    VALIDATE -->|No| ERROR[Show Error]
    ERROR --> FORM
    
    VALIDATE -->|Yes| CREATE[Create User Account<br/>Hash password]
    CREATE --> FREE_SUB[Create FREE Subscription]
    FREE_SUB --> EMAIL[Send Verification Email]
    
    EMAIL --> LOGIN[Auto Login]
    LOGIN --> DASHBOARD[Redirect to Dashboard]
    
    DASHBOARD --> WELCOME[Show Welcome Tour]
    WELCOME --> CREATE_KEY[Prompt: Create API Key]
    
    CREATE_KEY --> KEY_MODAL[API Key Creation Modal]
    KEY_MODAL --> GEN_KEY[Generate API Key<br/>ropt_xxxxxx]
    GEN_KEY --> DISPLAY[Display Key Once<br/>⚠️ Save this key]
    
    DISPLAY --> READY[Ready to Use API]
```

### API Key Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant API
    participant KeyGen
    participant Database

    User->>+Portal: Click "Create API Key"
    Portal->>User: Show modal form
    User->>Portal: Enter name, permissions
    Portal->>+API: POST /api/portal/keys
    
    API->>+KeyGen: generateApiKey()
    KeyGen->>KeyGen: Generate random key<br/>ropt_xxxxx
    KeyGen->>KeyGen: Hash key (bcrypt)
    KeyGen-->>-API: {key, hash, prefix}
    
    API->>+Database: Save API key<br/>{name, keyHash, prefix, userId}
    Database-->>-API: Created
    
    API-->>-Portal: Return plain key<br/>(last time visible)
    Portal->>User: Display key in modal<br/>⚠️ Copy this key now
```

### API Usage Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Validator
    participant Engine
    participant DB
    participant OSRM

    Client->>+API: POST /api/v1/optimize/route<br/>X-API-Key: ropt_xxx
    API->>+Validator: Validate API key
    Validator->>+DB: Find key & check status
    DB-->>-Validator: Key valid ✓
    Validator-->>-API: Authorized
    
    API->>+Validator: Check rate limit
    Validator->>+DB: Count recent requests
    DB-->>-Validator: 45/100
    Validator-->>-API: OK ✓
    
    API->>+Engine: optimizeRoute(payload)
    Engine->>Engine: Select algorithm<br/>(Christofides)
    Engine->>+OSRM: Get route data
    OSRM-->>-Engine: Route geometry
    Engine->>Engine: Optimize order
    Engine-->>-API: Optimized route
    
    API->>+DB: Log usage<br/>{endpoint, time, size}
    DB-->>-API: Logged
    
    API-->>-Client: 200 OK<br/>Optimized route
```

---

## 10. Admin Flows

### Admin Dashboard Overview

```mermaid
graph TB
    ADMIN[Admin Dashboard] --> USERS[User Management]
    ADMIN --> KEYS[API Key Management]
    ADMIN --> ANALYTICS[System Analytics]
    ADMIN --> AUDIT[Audit Logs]
    ADMIN --> CONFIG[System Configuration]
    
    USERS --> USER_LIST[View All Users]
    USERS --> USER_EDIT[Edit User]
    USERS --> USER_SUSPEND[Suspend/Delete]
    USERS --> ROLE_CHANGE[Change Role]
    
    KEYS --> KEY_LIST[All API Keys]
    KEYS --> KEY_REVOKE[Revoke Key]
    KEYS --> KEY_LIMITS[Adjust Limits]
    
    ANALYTICS --> METRICS[Usage Metrics]
    ANALYTICS --> REVENUE[Revenue Charts]
    ANALYTICS --> POPULAR[Popular Endpoints]
    
    AUDIT --> AUDIT_LIST[View Logs]
    AUDIT --> AUDIT_FILTER[Filter by Action]
```

### User Management Flow

```mermaid
sequenceDiagram
    participant Admin
    participant AdminPanel
    participant API
    participant DB
    participant AuditLog

    Admin->>+AdminPanel: Navigate to /admin/users
    AdminPanel->>+API: GET /api/admin/users
    API->>+DB: SELECT * FROM users
    DB-->>-API: User list
    API-->>-AdminPanel: Users data
    AdminPanel-->>-Admin: Display user table
    
    Admin->>+AdminPanel: Click "Suspend User"
    AdminPanel->>Admin: Confirm dialog
    Admin->>AdminPanel: Confirm
    
    AdminPanel->>+API: PUT /api/admin/users/{id}<br/>{status: "suspended"}
    API->>+DB: UPDATE users SET status
    DB-->>-API: Updated
    
    API->>+AuditLog: Log action<br/>{action: "USER_SUSPENDED"}
    AuditLog-->>-API: Logged
    
    API-->>-AdminPanel: Success
    AdminPanel-->>-Admin: Show success message
```

### Analytics Data Flow

```mermaid
flowchart LR
    subgraph "Data Sources"
        USAGE[usage_logs<br/>table]
        USERS[users<br/>table]
        SUBS[subscriptions<br/>table]
        INVOICES[invoices<br/>table]
    end
    
    subgraph "Aggregation Layer"
        AGG[Analytics API<br/>/api/admin/analytics]
    end
    
    subgraph "Metrics Calculated"
        TOTAL_USERS[Total Users]
        ACTIVE_USERS[Active Users<br/>Last 30 days]
        API_CALLS[Total API Calls]
        AVG_RESPONSE[Avg Response Time]
        REVENUE[Monthly Revenue]
        TOP_ENDPOINTS[Most Used Endpoints]
    end
    
    USAGE --> AGG
    USERS --> AGG
    SUBS --> AGG
    INVOICES --> AGG
    
    AGG --> TOTAL_USERS
    AGG --> ACTIVE_USERS
    AGG --> API_CALLS
    AGG --> AVG_RESPONSE
    AGG --> REVENUE
    AGG --> TOP_ENDPOINTS
```

---

## 11. Data Flow Diagrams

### Complete Request Lifecycle

```mermaid
flowchart TB
    START[Client Request] --> ENTRY{Entry Point}
    
    ENTRY -->|Web Browser| NEXTJS[Next.js App]
    ENTRY -->|AI Assistant| MCP[MCP Server]
    ENTRY -->|API Client| API_DIRECT[Direct API Call]
    
    NEXTJS --> AUTH_CHECK{Authenticated?}
    MCP --> MCP_PROXY[MCP→API Proxy]
    API_DIRECT --> API_AUTH[API Key Validation]
    
    AUTH_CHECK -->|No| LOGIN_PAGE[Redirect to Login]
    AUTH_CHECK -->|Yes| RENDER[Render React Page]
    
    RENDER --> CLIENT_API[Client-side API Call]
    CLIENT_API --> API_AUTH
    MCP_PROXY --> API_AUTH
    
    API_AUTH --> RATE{Rate Limit OK?}
    
    RATE -->|No| ERROR_429[429 Too Many Requests]
    RATE -->|Yes| ROUTING[API Route Handler]
    
    ROUTING --> ENGINE{Requires Engine?}
    
    ENGINE -->|Yes| AI_ENGINE[AI Optimization Engine]
    ENGINE -->|No| CRUD[Database CRUD]
    
    AI_ENGINE --> EXTERNAL{External APIs?}
    
    EXTERNAL -->|Yes| OSRM_CALL[OSRM API]
    EXTERNAL -->|Yes| TRAFFIC_CALL[TomTom API]
    EXTERNAL -->|No| COMPUTE[Compute Result]
    
    OSRM_CALL --> COMPUTE
    TRAFFIC_CALL --> COMPUTE
    
    COMPUTE --> LOG[Log Usage to DB]
    CRUD --> LOG
    
    LOG --> RESPONSE[Return Response]
    RESPONSE --> END[Client Receives Response]
```

### Multi-Cluster Optimization Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant MultiCluster
    participant Analyzer
    participant RouteEngine
    participant OSRM
    participant DB

    Client->>+API: POST /api/v1/optimize/multi-cluster<br/>{employees, cabs, office}
    
    API->>+MultiCluster: optimizeMultiCluster()
    
    MultiCluster->>+Analyzer: analyzeDistribution()<br/>Clustering
    Analyzer->>Analyzer: K-Means clustering<br/>by geography
    Analyzer->>Analyzer: Assign cabs<br/>to clusters
    Analyzer-->>-MultiCluster: Cab assignments
    
    loop For each cab/cluster
        MultiCluster->>+RouteEngine: optimizeRoute()<br/>employees subset
        RouteEngine->>RouteEngine: Select algorithm<br/>(based on count)
        RouteEngine->>+OSRM: Get route geometry
        OSRM-->>-RouteEngine: Route data
        RouteEngine->>RouteEngine: Optimize stop order
        RouteEngine-->>-MultiCluster: Optimized route
    end
    
    MultiCluster->>MultiCluster: Calculate metrics<br/>(total dist, utilization)
    MultiCluster-->>-API: All routes + metrics
    
    API->>+DB: Log usage
    DB-->>-API: Logged
    
    API-->>-Client: Response with<br/>multiple routes
```

---

## 12. Integration Points

### External Service Integrations

```mermaid
graph TB
    subgraph "Application Core"
        APP[Next.js App]
        ENGINE[AI Engine]
    end

    subgraph "Routing Services"
        OSRM[OSRM Server<br/>Open Source]
        MAPBOX[Mapbox Directions<br/>Commercial]
    end

    subgraph "Traffic Data"
        TOMTOM[TomTom Traffic API<br/>Commercial]
    end

    subgraph "Maps & Visualization"
        MAPBOX_MAPS[Mapbox GL JS<br/>Frontend Maps]
    end

    subgraph "Payment Processing"
        STRIPE[Stripe API<br/>Subscriptions]
        STRIPE_WEBHOOKS[Stripe Webhooks<br/>Events]
    end

    subgraph "Email Service"
        RESEND[Resend API<br/>Transactional Email]
    end

    ENGINE -->|Route calculation| OSRM
    ENGINE -->|Alternative| MAPBOX
    ENGINE -->|Traffic data| TOMTOM
    
    APP -->|Map display| MAPBOX_MAPS
    APP -->|Subscriptions| STRIPE
    STRIPE_WEBHOOKS -->|Payment events| APP
    APP -->|Send emails| RESEND
```

### Integration Details

| Service | Purpose | Configuration | Fallback |
|---------|---------|---------------|----------|
| **OSRM** | Primary routing | `OSRM_SERVER_URL` | Use Haversine distance |
| **Mapbox** | Map visualization | `NEXT_PUBLIC_MAPBOX_TOKEN` | No map display |
| **TomTom** | Live traffic | `TOMTOM_API_KEY` | Static time estimates |
| **Stripe** | Billing | `STRIPE_SECRET_KEY` | Manual billing |
| **Resend** | Email | `RESEND_API_KEY` | No emails |

---

## Summary

This architecture guide covers:

✅ **System Overview** - High-level architecture and components  
✅ **Repository Structure** - File organization and purposes  
✅ **AI Engine** - 10+ optimization algorithms and selection logic  
✅ **Next.js App** - App Router, components, middleware  
✅ **API Layer** - Public API, Portal API, Admin API endpoints  
✅ **MCP Server** - AI assistant integration via MCP protocol  
✅ **Database** - PostgreSQL schema with Prisma ORM  
✅ **Authentication** - NextAuth.js with role-based access  
✅ **User Flows** - Registration, API key creation, usage  
✅ **Admin Flows** - User management, analytics, audit logs  
✅ **Data Flows** - Request lifecycle and optimization flows  
✅ **Integrations** - External APIs and services  

### Key Takeaways

1. **Monolithic Next.js App**: Single application handles everything - frontend, backend, API, auth
2. **AI Engine Core**: Sophisticated optimization with multiple algorithms (Christofides, Genetic, Exhaustive)
3. **MCP Integration**: Enables AI assistants to use optimization tools
4. **Database-Driven**: PostgreSQL stores all user data, API keys, usage logs
5. **Role-Based Access**: USER and ADMIN roles with middleware protection
6. **API-First Design**: Public API for external clients, internal API for portal
7. **Scalable Architecture**: Caching, rate limiting, microservice-ready structure
