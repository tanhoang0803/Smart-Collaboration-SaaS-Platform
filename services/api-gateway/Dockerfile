# =============================================================================
# Multi-stage Dockerfile for api-gateway
#
# Stage 1 (builder): installs production dependencies only
# Stage 2 (runner):  copies node_modules + src, runs as non-root user
#
# Why multi-stage?
#  - Stage 1 uses the full alpine image with build tools (node-gyp, etc.)
#  - Stage 2 is a lean runtime image with no dev dependencies
#  - Final image is as small as possible — fewer attack-surface packages
# =============================================================================

# ── Stage 1: Install production dependencies ─────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first — Docker layer cache means npm ci only re-runs
# when package.json or package-lock.json changes, not on source changes
COPY package.json package-lock.json* ./

# Install production deps only — no devDependencies in the final image
RUN npm ci --only=production --ignore-scripts

# ── Stage 2: Lean runtime image ──────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user (node user exists in the node:alpine image)
# Must be set before COPY so files are owned by node
WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY package.json ./

# Drop to non-root user — principle of least privilege
USER node

# Document which port the service listens on (informational; docker-compose maps it)
EXPOSE 8080

# Health check — used by Docker, Kubernetes readiness probe, load balancers
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

CMD ["node", "src/index.js"]
