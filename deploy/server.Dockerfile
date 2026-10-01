# Build context: repo root. Dokploy: Dockerfile path = deploy/server.Dockerfile
FROM oven/bun:1.4-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY packages/content/package.json packages/content/
COPY packages/games/trivia/package.json packages/games/trivia/
COPY packages/games/icebreakers/package.json packages/games/icebreakers/
COPY packages/games/wit/package.json packages/games/wit/
COPY packages/games/doodle/package.json packages/games/doodle/
RUN bun install --frozen-lockfile --production --filter server
COPY packages packages
COPY apps/server apps/server
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
VOLUME /data
EXPOSE 3001
WORKDIR /app/apps/server
# Bun receives SIGTERM directly (no shell wrapper) so rooms get snapshotted on redeploy.
CMD ["bun", "src/index.ts"]
