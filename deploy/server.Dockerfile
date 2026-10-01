# Build context: repo root. Dokploy: Dockerfile path = deploy/server.Dockerfile
FROM oven/bun:1.4-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
RUN bun install --frozen-lockfile --production --filter server
COPY packages packages
COPY apps/server apps/server
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
VOLUME /data
EXPOSE 3001
WORKDIR /app/apps/server
# Bun receives SIGTERM directly (no shell wrapper) so rooms get snapshotted on redeploy.
CMD ["bun", "src/index.ts"]
