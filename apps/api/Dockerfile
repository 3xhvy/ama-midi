FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi

RUN pnpm --filter @ama-midi/shared build
RUN cd apps/api && npx prisma generate
RUN pnpm --filter @ama-midi/api build
RUN pnpm --filter @ama-midi/api --prod deploy /prod/api

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache wget

# Prisma CLI for migrate deploy on container start
RUN npm install -g prisma@7.8.0 --ignore-scripts

# Prisma 7.x: datasource.url for migrate deploy (evaluated at container runtime)
RUN printf 'export default { datasource: { url: process.env["DATABASE_URL"] } };\n' > /app/prisma.config.mjs

COPY --from=builder /prod/api/dist ./dist
COPY --from=builder /prod/api/node_modules ./node_modules
COPY --from=builder /prod/api/package.json ./
COPY --from=builder /prod/api/prisma ./prisma
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD wget -q --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
