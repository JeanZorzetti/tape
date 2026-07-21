# Build + runtime do site Astro (Node standalone) para o Easypanel.
# O Postgres é um serviço separado no mesmo projeto do Easypanel.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./
EXPOSE 4321
# O ping de indexação é na SUBIDA do container, não no build: no build o
# conteúdo novo ainda não está no ar e o rastreador acharia a versão antiga
# (research.md D1). Roda desanexado para não atrasar o health check, e o
# `exec` mantém o servidor no PID 1 para receber o SIGTERM do orquestrador.
CMD (sleep 15; node scripts/indexnow.mjs) & exec node ./dist/server/entry.mjs
