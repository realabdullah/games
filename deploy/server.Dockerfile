# Build context: repo root. Dokploy: Dockerfile path = deploy/server.Dockerfile
# Pinned to the Bun version that wrote bun.lock.
FROM oven/bun:1.4.2-alpine
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
COPY packages/games/xo/package.json packages/games/xo/
COPY packages/games/wordrace/package.json packages/games/wordrace/
COPY packages/games/hangman/package.json packages/games/hangman/
COPY packages/games/emoji/package.json packages/games/emoji/
COPY packages/games/maths/package.json packages/games/maths/
RUN bun install --frozen-lockfile --production --filter server
COPY packages packages
COPY apps/server apps/server
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
# Run as the image's unprivileged user; a fresh volume at /data inherits this ownership.
RUN mkdir -p /data && chown bun:bun /data
USER bun
VOLUME /data
EXPOSE 3001
WORKDIR /app/apps/server
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
	CMD bun -e "fetch('http://127.0.0.1:3001/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Bun receives SIGTERM directly (no shell wrapper) so rooms get snapshotted on redeploy.
CMD ["bun", "src/index.ts"]
