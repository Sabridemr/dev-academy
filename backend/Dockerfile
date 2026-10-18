# DevAcademy API — çok aşamalı imaj. Monorepo kökünden derlenir:
#   docker build -f backend/Dockerfile -t devacademy-api .
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache openssl libc6-compat
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter @devacademy/backend... --filter devacademy

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter @devacademy/shared build \
 && pnpm --filter @devacademy/backend exec prisma generate \
 && pnpm --filter @devacademy/backend build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
COPY content /repo/content
WORKDIR /repo/backend
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://localhost:4000/health || exit 1
# Açılışta bekleyen migration'ları uygular, sonra API'yi başlatır
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
