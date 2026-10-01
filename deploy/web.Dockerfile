# Build context: repo root. Dokploy: Dockerfile path = deploy/web.Dockerfile
FROM oven/bun:1.4-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run --filter web build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/build /srv
EXPOSE 80
