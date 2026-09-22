# syntax=docker/dockerfile:1.7

ARG NODE_MAJOR=24

FROM node:${NODE_MAJOR}-bookworm-slim AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=post-sentry-pnpm-openssl3,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm exec prisma -v \
    && test -n "$(find node_modules \
        -type f \
        -name 'schema-engine-debian-openssl-3.0.x' \
        -print \
        -quit)"

FROM dependencies AS build

COPY prisma ./prisma

RUN pnpm exec prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN pnpm exec tsc

FROM node:${NODE_MAJOR}-bookworm-slim AS production

ENV NODE_ENV=production
ENV PRISMA_HIDE_UPDATE_MESSAGE=true
ENV HOME=/tmp

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma ./prisma

COPY --chown=node:node --chmod=755 \
    docker-entrypoint.sh \
    ./docker-entrypoint.sh

RUN mkdir -p /app/data \
    && chown node:node /app/data

USER node

ENTRYPOINT ["/app/docker-entrypoint.sh"]
