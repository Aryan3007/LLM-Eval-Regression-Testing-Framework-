# syntax=docker/dockerfile:1
FROM node:22.23.5-alpine3.24 AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:22.23.5-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S docsbot && adduser -S docsbot -G docsbot \
  && mkdir -p /app/data && chown docsbot:docsbot /app/data
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
COPY prompts ./prompts
USER docsbot
EXPOSE 8001
# Migrations run before the server accepts traffic.
CMD ["sh", "-c", "node dist/db/migrate.cli.js && node dist/api/server.js"]
