# DevAcademy API — çok aşamalı imaj. Monorepo kökünden derlenir:
#   docker build -f backend/Dockerfile -t devacademy-api .                  # API (ince, root olmayan)
#   docker build -f backend/Dockerfile --target tools -t devacademy-tools . # migration + seed araçları
#
# Runtime imajı yalnızca üretim bağımlılıklarını ve derlenmiş kodu içerir. Migration'lar API açılışında
# değil, ayrı bir adımda (tools imajı: `prisma migrate deploy`) uygulanır; böylece birden fazla replika
# aynı anda migration çalıştırmaya çalışmaz.
FROM node:26-alpine AS base
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

# Migration ve seed için araç imajı (prisma CLI ve tsx geliştirme bağımlılıklarıdır)
FROM build AS tools
COPY content /repo/content
WORKDIR /repo/backend
CMD ["sh", "-c", "pnpm exec prisma migrate deploy"]

# Yalnızca üretim bağımlılıklarıyla bağımsız backend paketi; Prisma istemcisi bu pakete üretilir
FROM build AS deploy
RUN pnpm --filter @devacademy/backend deploy --prod --legacy /out \
 && cd /out && /repo/node_modules/.bin/prisma generate --schema prisma/schema.prisma \
 && rm -rf /out/src /out/test

FROM node:26-alpine AS runtime
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy --chown=node:node /out /app
COPY --from=build --chown=node:node /repo/backend/dist /app/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/main.js"]
