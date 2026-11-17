FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
RUN npm run build -w backend && npm prune --omit=dev
RUN mkdir -p /run/demo-secrets && chown node:node /run/demo-secrets
USER node
EXPOSE 3000
CMD ["node", "backend/scripts/container-start.mjs"]
