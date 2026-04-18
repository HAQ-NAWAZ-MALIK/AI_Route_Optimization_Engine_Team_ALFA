# MCP Integration Setup Guide

## Quick Start

### 1. Install MCP Server Dependencies

```bash
npm run mcp:install
```

### 2. Configure Environment

```bash
cd mcp-server
cp .env.example .env
# Edit .env and set your API keys
```

### 3. Build MCP Server

```bash
npm run mcp:build
```

### 4. Run MCP Server

**Stdio mode (for Claude Desktop)**:
```bash
npm run mcp:dev
```

**HTTP mode (for remote access)**:
```bash
npm run mcp:http
```

---

## Configuration for Claude Desktop

1. **Find your Claude config file**:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add this configuration**:

```json
{
  "mcpServers": {
    "ai-transport-optimizer": {
      "command": "node",
      "args": [
        "C:\\full\\path\\to\\ai-transport-optimizer-standalone-v2\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "MCP_REQUIRE_AUTH": "false",
        "OSRM_SERVER_URL": "https://router.project-osrm.org",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

3. **Restart Claude Desktop**

4. **Test it**:
```
Ask Claude: "Optimize a route starting from office at 28.6139, 77.2090, 
picking up employees at:
- 28.5355, 77.3910 (John)
- 28.7041, 77.1025 (Jane)
Departure time is 8:00 AM"
```

---

##Complete documentation

See [mcp-server/README.md](file:///c:/Users/ACER/Downloads/ai-transport-optimizer-standalone-v2/mcp-server/README.md) for:
- Detailed configuration options
- HTTP server deployment
- Troubleshooting guide
- Integration examples

---

## Notes

- The MCP server is completely separate from the Next.js app
- Your existing REST API (`/api/v1/*`) is unaffected
- MCP server imports the AI engine at runtime
- No changes needed to existing codebase
