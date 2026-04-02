# =============================================================================
# AI Service — Multi-stage Dockerfile
# Stage 1: install production dependencies
# Stage 2: lean runtime image
# =============================================================================

# ---- Stage 1: builder -------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production

# ---- Stage 2: runner --------------------------------------------------------
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling (PID 1)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

# Use non-root user for security
USER node

EXPOSE 3004

# dumb-init ensures SIGTERM is forwarded correctly to Node.js
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
