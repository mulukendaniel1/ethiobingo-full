FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ ./packages/
COPY apps/bingo-game-engine/package.json ./apps/bingo-game-engine/
RUN bun install

FROM oven/bun:1.2 AS production
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1
CMD ["bun", "run", "apps/bingo-game-engine/src/index.ts"]