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
# Fora do ar desde 14/10/2026: o servidor sobe atrás de scripts/fora-do-ar.mjs
# (503 no público, /admin de pé) e o ping do IndexNow fica desligado, porque
# avisaria o rastreador de páginas que respondem 503. Voltar ao ar = reverter
# este commit, que devolve o CMD com o ping na subida do container.
CMD ["node", "scripts/fora-do-ar.mjs"]
