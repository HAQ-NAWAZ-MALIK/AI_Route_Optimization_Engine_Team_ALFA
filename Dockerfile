# ============================================================================
# AI Transport Optimizer - Production Dockerfile
# ============================================================================
# Multi-stage build for optimal image size and security
# Based on SCALABILITY_AND_INTEGRATION_GUIDE.md specifications

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install ALL dependencies (including devDependencies) — the build needs
# typescript, tailwindcss, postcss, etc. The final runtime stage uses Next's
# standalone output, which bundles only the production deps it actually needs,
# so these dev deps never reach the shipped image.
COPY package.json package-lock.json* ./
RUN npm ci

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma on Alpine needs OpenSSL present so it detects the right (openssl-3.0.x)
# query engine at `prisma generate` time instead of defaulting to 1.1.x.
RUN apk add --no-cache openssl libc6-compat

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* vars are inlined into the CLIENT bundle at build time, so they
# must be provided here (a runtime env var / ConfigMap value is too late for the
# browser code). Pass with: docker build --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=...
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN

# Generate the Prisma client (needs prisma/schema.prisma, which npm ci in the
# deps stage didn't have). Produces the linux-musl query engine for alpine.
RUN npx prisma generate

# Build the application
RUN npm run build

# ============================================================================
# Stage 3: Production Runner
# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Runtime needs OpenSSL for the Prisma query engine's shared libs (libssl).
RUN apk add --no-cache openssl libc6-compat

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy OpenAPI spec for documentation
COPY --from=builder /app/openapi.yaml ./openapi.yaml

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Set the port environment variable
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start the application
CMD ["node", "server.js"]
