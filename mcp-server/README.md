# 🚀 AI Transport Optimizer - MCP Server

Enable **any LLM** (Claude, ChatGPT, etc.) to optimize routes directly from their interfaces!

## What is This?

This Model Context Protocol (MCP) server wraps the AI Transport Optimizer engine, making it accessible to all MCP-compatible LLMs. Users can request route optimizations through natural conversation with their AI assistant.

## Features

✅ **3 Powerful Tools**:
- `optimize_route` - Optimize single-vehicle routes
- `optimize_multi_cluster` - Multi-vehicle optimization with clustering
- `calculate_distance_matrix` - Distance/time calculations

✅ **Dual Transport Support**:
- **Stdio** - For local clients like Claude Desktop
- **HTTP** - For remote access and web-based LLMs

✅ **Production-Ready**:
- API key authentication
- Rate limiting
- Comprehensive error handling
- Request logging
- CORS support

---

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and set your configuration
```

**Minimum required configuration**:
```env
MCP_API_KEYS=your-secret-key-here
MCP_REQUIRE_AUTH=true  # Set to false for development only
OSRM_SERVER_URL=https://router.project-osrm.org
```

### 3. Build the Server

```bash
npm run build
```

---

## Usage

### Option A: Local (stdio) - For Claude Desktop

1. **Add to Claude Desktop Config**:

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ai-transport-optimizer": {
      "command": "node",
      "args": [
        "C:\\path\\to\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "MCP_REQUIRE_AUTH": "false",
        "OSRM_SERVER_URL": "https://router.project-osrm.org"
      }
    }
  }
}
```

2. **Restart Claude Desktop**

3. **Test with a prompt**:
```
"Optimize a route starting from office at 28.6139, 77.2090, 
picking up employees at:
- 28.5355, 77.3910 (John)
- 28.7041, 77.1025 (Jane)  
- 28.4595, 77.0266 (Bob)
Departure time is 8:00 AM"
```

Claude will automatically use the `optimize_route` tool!

---

### Option B: Remote (HTTP) - For Any LLM

1. **Start HTTP Server**:

```bash
npm run http
```

Server will start at `http://localhost:3001`

2. **Test with curl**:

```bash
# Health check
curl http://localhost:3001/health

# List tools
curl -H "X-API-Key: your-secret-key-here" \
  http://localhost:3001/api/tools

# Optimize route
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key-here" \
  -d '{
    "origin": {"lat": 28.6139, "lng": 77.2090},
    "destinations": [
      {"id": "1", "lat": 28.5355, "lng": 77.3910, "name": "John"},
      {"id": "2", "lat": 28.7041, "lng": 77.1025, "name": "Jane"}
    ],
    "tripType": "pickup",
    "constraints": {"departureTime": "08:00"}
  }' \
  http://localhost:3001/api/tools/optimize_route
```

---

## Tool Reference

### 1. optimize_route

**Purpose**: Optimize a single route for pickup/drop operations

**Input**:
```json
{
  "origin": {
    "lat": 28.6139,
    "lng": 77.2090,
    "name": "Office"
  },
  "destinations": [
    {
      "id": "emp1",
      "lat": 28.5355,
      "lng": 77.3910,
      "name": "John Doe",
      "preferredPickupTime": "08:30"
    }
  ],
  "tripType": "pickup",
  "constraints": {
    "departureTime": "08:00",
    "maxTotalDuration": 90,
    "bufferPerStop": 2
  },
  "options": {
    "algorithm": "auto",
    "useRealRoads": true
  }
}
```

**Output**:
- Optimized stop sequence
- Total distance and duration
- Arrival/departure times for each stop
- Algorithm used and efficiency metrics

---

### 2. optimize_multi_cluster

**Purpose**: Distribute employees across multiple cabs and optimize routes

**Input**:
```json
{
  "office": {
    "lat": 28.6139,
    "lng": 77.2090,
    "name": "HQ"
  },
  "employees": [
    {"id": "1", "lat": 28.5355, "lng": 77.3910, "name": "John"},
    {"id": "2", "lat": 28.7041, "lng": 77.1025, "name": "Jane"}
    // ... more employees
  ],
  "cabs": [
    {"id": "cab1", "name": "Cab 1", "capacity": 6},
    {"id": "cab2", "name": "Cab 2", "capacity": 4}
  ]
}
```

**Output**:
- Employee-to-cab assignments
- Cluster metrics
- Warnings (if any capacity issues)

---

### 3. calculate_distance_matrix

**Purpose**: Get pairwise distances between locations

**Input**:
```json
{
  "coordinates": [
    {"lat": 28.6139, "lng": 77.2090},
    {"lat": 28.5355, "lng": 77.3910},
    {"lat": 28.7041, "lng": 77.1025}
  ],
  "useRealRoads": true
}
```

**Output**:
- Distance matrix (km)
- Duration matrix (minutes)
- Calculation method used

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_API_KEYS` | Comma-separated API keys | Required |
| `MCP_REQUIRE_AUTH` | Enable authentication | `true` |
| `MCP_HTTP_PORT` | HTTP server port | `3001` |
| `MCP_HTTP_HOST` | HTTP server host | `localhost` |
| `MCP_ENABLE_CORS` | Enable CORS | `true` |
| `OSRM_SERVER_URL` | OSRM routing server | Public OSRM |
| `MAX_LOCATIONS` | Max locations per request | `100` |
| `LOG_LEVEL` | Logging level | `info` |

---

## Security Best Practices

### 🔐 Authentication

**For Production**:
- Always use `MCP_REQUIRE_AUTH=true`
- Generate strong API keys: `openssl rand -hex 32`
- Rotate keys regularly
- Use different keys for different clients

**For Development**:
- You can disable auth with `MCP_REQUIRE_AUTH=false`
- Only recommended for local testing

### 🛡️ HTTP Server Security

When deploying HTTP server publicly:

1. **Use HTTPS**: Deploy behind reverse proxy (nginx, Caddy)
2. **Rate Limiting**: Already enabled by default
3. **CORS**: Configure allowed origins in `.env`
4. **Network**: Use firewall rules to restrict access

---

## Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY mcp-server/package*.json ./
RUN npm ci --production
COPY mcp-server/dist ./dist
COPY src/lib ./lib
ENV NODE_ENV=production
CMD ["node", "dist/http-server.js"]
```

```bash
docker build -t mcp-transport-optimizer .
docker run -p 3001:3001 \
  -e MCP_API_KEYS=your-key \
  mcp-transport-optimizer
```

### Cloud Platforms

**Railway**:
```bash
railway up
```

**Render**:
- Set build command: `cd mcp-server && npm install && npm run build`
- Set start command: `node mcp-server/dist/http-server.js`

**Vercel** (Serverless):
- Not recommended for MCP server (requires persistent connection)
- Use Railway or Render instead

---

## Troubleshooting

### "AI optimization engine not available"

**Cause**: MCP server can't import the AI engine

**Solution**:
1. Make sure parent project is built: `cd .. && npm run build`
2. Check TypeScript path mapping in `tsconfig.json`
3. Verify `src/lib/ai-engine/index.js` exists

### "OSRM server unavailable"

**Cause**: Can't connect to routing service

**Solution**:
1. Check `OSRM_SERVER_URL` in `.env`
2. Verify internet connection
3. Try public server: `https://router.project-osrm.org`

### "Invalid API key"

**Cause**: Authentication failed

**Solution**:
1. Check `X-API-Key` header matches `.env` value
2. For Claude Desktop, set `MCP_REQUIRE_AUTH=false` in config
3. Verify `.env` file is loaded

---

## Development

### Run in Development Mode

```bash
# Stdio server
npm run dev

# HTTP server  
npm run http
```

### Testing

```bash
npm test
```

### Debugging

Enable debug logging:
```env
LOG_LEVEL=debug
LOG_REQUESTS=true
```

---

## Integration Examples

### With Claude Desktop

See "Usage" section above for configuration.

### With ChatGPT (Custom GPT)

1. Deploy HTTP server publicly (with HTTPS)
2. Create Custom GPT with OpenAPI schema
3. Configure authentication with API key
4. Users can invoke tools through ChatGPT

### With Custom LLM Client

```typescript
import { createMCPClient } from '@modelcontextprotocol/sdk/client';

const client = createMCPClient({
  url: 'http://localhost:3001/mcp',
  headers: {
    'X-API-Key': 'your-key',
  },
});

const result = await client.callTool('optimize_route', {
  origin: { lat: 28.6139, lng: 77.2090 },
  destinations: [/* ... */],
  tripType: 'pickup',
  constraints: { departureTime: '08:00' },
});
```

---

## FAQ

**Q: Does this affect my existing Next.js app?**  
A: No! The MCP server is completely separate. It imports the AI engine but doesn't modify it.

**Q: Can I use this without authentication?**  
A: Yes, for local development. Set `MCP_REQUIRE_AUTH=false`. Never do this in production.

**Q: How many locations can I optimize?**  
A: Default limit is 100 locations. Configure with `MAX_LOCATIONS` in `.env`.

**Q: Does it support traffic data?**  
A: Yes, if you provide `TOMTOM_API_KEY` in `.env` and use `considerTraffic: true`.

---

## Support

- **Issues**: Open an issue on GitHub
- **Documentation**: See `/SCALABILITY_AND_INTEGRATION_GUIDE.md` in parent project
- **API Spec**: See `/openapi.yaml` for REST API details

---

## License

MIT - Same as parent project
