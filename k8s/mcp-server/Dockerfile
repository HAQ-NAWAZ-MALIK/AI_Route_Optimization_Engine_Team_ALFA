# ============================================================================
# MCP Server image
# ============================================================================
# Build context MUST be the repo root, because the MCP server dynamically loads
# the parent app's optimization engine from ../../../src/lib/* at runtime.
#
#   docker build -f k8s/mcp-server/Dockerfile -t <registry>/route-optimizer-mcp:latest .
#
# Runs the HTTP MCP server (Express) via tsx, which resolves the TypeScript
# engine sources on the fly (the engine subtree uses only relative imports).
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Root deps (needed by src/lib/*) + MCP server deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Full install (not --omit=dev) so the tsx runtime is available.
COPY mcp-server/package.json ./mcp-server/
RUN cd mcp-server && npm install

# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3001

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodejs

# Dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mcp-server/node_modules ./mcp-server/node_modules

# Source: the MCP server plus the engine it imports at runtime
COPY mcp-server/ ./mcp-server/
COPY src/lib/ ./src/lib/
COPY tsconfig.json ./tsconfig.json

USER nodejs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# tsx is a dev/runtime TS runner shipped in mcp-server devDependencies; run it
# from the local node_modules so no global install is required.
CMD ["node", "mcp-server/node_modules/.bin/tsx", "mcp-server/src/http-server.ts"]
