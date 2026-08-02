# Non-root API image — one container, listens on 8000 (DESIGN §9).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @locus/api...

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN corepack enable \
  && groupadd --system --gid 10001 locus \
  && useradd --system --uid 10001 --gid locus --home-dir /app --shell /usr/sbin/nologin locus \
  && mkdir -p /data/media \
  && chown -R locus:locus /data /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

ENV NODE_ENV=production \
    MEDIA_ROOT=/data/media \
    PORT=8000

USER locus
EXPOSE 8000
WORKDIR /app/apps/api
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
