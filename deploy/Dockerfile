# syntax=docker/dockerfile:1
#
# One image for every service (ADR-009: build once, promote the same artifact). What a container does is chosen by its start command:
#   web      node apps/web/.next/standalone/apps/web/server.js      (the default)
#   worker   pnpm --filter worker start
#   release  pnpm --filter @ador/database migration:apply
# See docs/operations/deployment.md. Secrets are never in the image: they come from the platform's environment at run time.

ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm COREPACK_HOME=/opt/corepack PATH=/pnpm:$PATH
WORKDIR /app
RUN corepack enable

FROM base AS build
# ffmpeg draws the scene videos that browsers without a canvas play (tooling/scene-render).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
COPY . .
# The package manager is the version the repository pins (package.json "packageManager"), fetched once here into COREPACK_HOME and copied
# to the final image, so a container never downloads anything when it starts (the release step runs pnpm).
RUN corepack install
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm scenes:render
# The build makes the games (prebuild) and then the standalone server. It reads no secrets: configuration is validated when the server starts.
RUN pnpm --filter web build
# What the standalone server needs beside itself (the same copy `start:standalone` makes at start-up, made once here).
RUN rm -rf apps/web/.next/standalone/apps/web/.next/static apps/web/.next/standalone/apps/web/public \
 && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
 && cp -r apps/web/public apps/web/.next/standalone/apps/web/public \
 && rm -rf apps/web/.next/cache
# Drop what only building and testing need. `pnpm prune` cannot do this in a workspace (it empties each package's own node_modules), so the
# production install is repeated from the same lockfile; CI=true lets pnpm replace node_modules without a terminal to ask.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store CI=true pnpm install --frozen-lockfile --prod

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /opt/corepack /opt/corepack
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
# Next.js reads HOSTNAME to choose the address it listens on; the platform's router reaches the container on all of them.
ENV HOSTNAME=0.0.0.0 PORT=3000
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
