# API Itinhero (spec 04). Node 22 LTS épinglé, jamais `latest`.
FROM node:22.23.4-alpine3.24 AS construction
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22.23.4-alpine3.24
ENV NODE_ENV=production
WORKDIR /app
COPY --from=construction --chown=node:node /app/node_modules ./node_modules
COPY --from=construction --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Spec 29 : dossier du volume de `abonnements_alerte`, à l'utilisateur node (un volume neuf en reprend le propriétaire).
RUN mkdir -p /var/lib/itinhero && chown node:node /var/lib/itinhero
USER node
EXPOSE 3000
# Spec 50 : Sentry chargé avant l'API (sans effet sans SENTRY_DSN_SERVEUR).
CMD ["node", "--import", "./dist/instrument.js", "dist/index.js"]
