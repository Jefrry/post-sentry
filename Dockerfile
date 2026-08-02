# syntax=docker/dockerfile:1.7

ARG NODE_MAJOR=24

FROM node:${NODE_MAJOR}-bookworm-slim AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS build

COPY prisma ./prisma
RUN pnpm prisma:generate

COPY tsconfig.json ./
COPY src ./src
RUN pnpm exec tsc

FROM build AS production-dependencies

RUN pnpm exec prisma -v

FROM node:${NODE_MAJOR}-bookworm-slim AS production

ENV NODE_ENV=production
ENV PRISMA_HIDE_UPDATE_MESSAGE=true
ENV HOME=/tmp

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/data && chown node:node /app/data

USER node

ENTRYPOINT ["/app/docker-entrypoint.sh"]
