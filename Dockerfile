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
COPY --from=build /app/package.json ./
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
