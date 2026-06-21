# syntax=docker/dockerfile:1

FROM node:20-alpine AS web-builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY api/package.json ./api/
COPY extension/package.json ./extension/
RUN npm ci --workspace=web

COPY web/ ./web/
ENV VITE_API_URL=/api
RUN npm run build --workspace=web

FROM node:20-alpine AS api-builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
COPY extension/package.json ./extension/
RUN npm ci --workspace=api

COPY api/ ./api/
RUN npm run build --workspace=api

FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_ROOT=/app/storage

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
COPY extension/package.json ./extension/
RUN npm ci --workspace=api --omit=dev

COPY --from=api-builder /app/api/dist ./api/dist
COPY --from=web-builder /app/web/dist ./web/dist

RUN mkdir -p /app/storage

WORKDIR /app/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "dist/main.js"]
