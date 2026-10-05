# Build context: repo root. Dokploy: Dockerfile path = deploy/web.Dockerfile
# Pinned to the Bun version that wrote bun.lock.
FROM oven/bun:1.4.2-alpine AS build
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
COPY packages/games/clock/package.json packages/games/clock/
COPY packages/games/findit/package.json packages/games/findit/
RUN bun install --frozen-lockfile
COPY . .
# Optional: your self-hosted GoatCounter, e.g. https://stats.example.com
ARG VITE_GOATCOUNTER_URL
ENV VITE_GOATCOUNTER_URL=$VITE_GOATCOUNTER_URL
RUN bun run --filter web build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/build /srv
EXPOSE 80
