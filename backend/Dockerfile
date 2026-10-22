# DevAcademy API — çok aşamalı imaj. Monorepo kökünden derlenir:
#   docker build -f backend/Dockerfile -t devacademy-api .                  # API (ince, root olmayan)
#   docker build -f backend/Dockerfile --target tools -t devacademy-tools . # migration + seed araçları
#
# Her iki imaj da `deploy` aşamasının ürettiği yalnızca-üretim bağımlılıklarını kullanır; tools imajı buna
# yalnızca prisma CLI, tsx, dotenv, şema/migration'lar ve content/ klasörünü ekler (pnpm ve monorepo
# node_modules'ı taşımaz). Seed: `docker compose run --rm seed` → `tsx prisma/seed.ts`.
#
# Runtime imajı yalnızca üretim bağımlılıklarını ve derlenmiş kodu içerir. Migration'lar API açılışında
# değil, ayrı bir adımda (tools imajı: `prisma migrate deploy`) uygulanır; böylece birden fazla replika
# aynı anda migration çalıştırmaya çalışmaz.
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

# Yalnızca üretim bağımlılıklarıyla bağımsız backend paketi; Prisma istemcisi bu pakete üretilir
FROM build AS deploy
RUN pnpm --filter @devacademy/backend deploy --prod --legacy /out \
 && cd /out && /repo/node_modules/.bin/prisma generate --schema prisma/schema.prisma \
 && rm -rf /out/src /out/test

# Araç imajının bağımlılıkları: deploy çıktısı (üretim bağımlılıkları + üretilmiş Prisma istemcisi; prisma CLI
# @prisma/client'ın eş bağımlılığı olarak zaten içinde) üzerine seed'in istediği tek geliştirme bağımlılığı dotenv
# kopyalanır. tsx ayrı bir dizine (/tools/cli) lockfile'daki sürümüne sabitlenerek kurulur; böylece backend'in
# diğer geliştirme bağımlılıkları (nest cli, jest, ...) taşınmaz.
FROM deploy AS tools-deps
RUN test -x /out/node_modules/.bin/prisma \
 && mkdir -p /tools/cli && cp -a /out /tools/backend \
 && cp -a /repo/node_modules/dotenv /tools/backend/node_modules/dotenv \
 && cd /tools/cli && echo '{"private":true}' > package.json \
 && npm install --no-audit --no-fund --no-update-notifier \
      "tsx@$(node -p "require('/repo/node_modules/tsx/package.json').version")" \
 && npm cache clean --force

# Migration ve seed için araç imajı: `prisma migrate deploy` (varsayılan) ve `tsx prisma/seed.ts`.
# pnpm içermez; prisma ve tsx PATH'tedir. CONTENT_DIR=../content → /repo/content
FROM node:22-alpine AS tools
RUN apk add --no-cache openssl libc6-compat
ENV PATH=/repo/backend/node_modules/.bin:/repo/cli/node_modules/.bin:$PATH
WORKDIR /repo/backend
COPY tsconfig.base.json /repo/
COPY --from=tools-deps /tools /repo
COPY content /repo/content
# seed.ts, backend kaynaklarından içe aktarım yapar (src/modules/admin/content-sync.ts); tsx bunları
# kaynak olarak çalıştırır, deploy çıktısı src'yi içermediği için ayrıca kopyalanır
COPY backend/src /repo/backend/src
CMD ["prisma", "migrate", "deploy"]

# Varsayılan hedef (son aşama): API runtime imajı
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy --chown=node:node /out /app
COPY --from=build --chown=node:node /repo/backend/dist /app/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/main.js"]
