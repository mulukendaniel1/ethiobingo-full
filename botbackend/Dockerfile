# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN apk add --no-cache python3 make g++ curl && \
    npm install -g bun && \
    bun install --production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN apk add --no-cache python3 make g++ && \
    npm install -g bun && \
    bun install && \
    bun run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies (no mongodb-tools – we use Node.js native backup)
RUN apk add --no-cache curl tzdata && \
    addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Create necessary directories
RUN mkdir -p /app/logs /app/sessions /app/backups && \
    chown -R appuser:appuser /app

# Copy built application
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package.json ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]