FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:standalone

FROM node:24-bookworm-slim
ENV NODE_ENV=production CMS_HOST=0.0.0.0 PORT=3100 CMS_DATA_DIR=/app/data
WORKDIR /app
COPY --from=build --chown=node:node /app/standalone-dist ./standalone-dist
COPY --chown=node:node core ./core
COPY --chown=node:node standalone/*.mjs ./standalone/
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 3100
CMD ["node","standalone/server.mjs"]
