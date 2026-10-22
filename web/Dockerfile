# DevAcademy web — Next.js standalone çıktısı. Monorepo kökünden derlenir:
#   docker build -f web/Dockerfile -t devacademy-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 .
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter @devacademy/web... --filter devacademy

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY web web
RUN pnpm --filter @devacademy/shared build && pnpm --filter @devacademy/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/web/.next/static ./web/.next/static
# PWA manifest, service worker ve ikonlar (standalone çıktısı public/ klasörünü içermez)
COPY --from=build --chown=app:app /repo/web/public ./web/public
USER app
EXPOSE 3000
# Sağlık kontrolü statik PWA manifest'ine yapılır: ana sayfa (/) SSR ile API'den veri çeker ve middleware'den
# (CSP nonce) geçer, yani hem daha ağırdır hem de API'nin durumuna bağlıdır. manifest.webmanifest public/
# altından doğrudan sunulur ve middleware matcher'ı dışındadır; yalnızca Next sunucusunun ayakta olduğunu ölçer.
# (alpine imajında wget hazır gelir; backend/Dockerfile ile aynı aralıklar)
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3000/manifest.webmanifest > /dev/null || exit 1
CMD ["node", "web/server.js"]
