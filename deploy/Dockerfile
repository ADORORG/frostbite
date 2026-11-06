# syntax=docker/dockerfile:1
#
# One image for every service (ADR-009: build once, promote the same artifact). What a container does is chosen by the build
# target or the start command:
#   web      applies the pending migrations, then node apps/web/.next/standalone/apps/web/server.js   (target `web`, the default)
#   worker   pnpm --filter worker start                                                                (target `worker`)
#   release  pnpm --filter @frostbite/database migration:apply   (by hand, or a platform that wants a separate step)
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
# An image carries only the released contract templates: the kept copies must equal contracts/templates/release.json. (They are not rebuilt
# here: the same source builds to different bytes in a different environment.)
RUN pnpm --filter @repo/repository-policy check:templates
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
# Where the platform reads game-rewards.wasm and milestone-collectible.wasm (the released ones, checked in the build). A deployment may set
# the variable to something else (or to nothing, which turns template publishing off); local runs and tests point it at their own build.
ENV REWARDS_TEMPLATES_DIR=/opt/templates
COPY --from=build /app/contracts/templates/released /opt/templates
COPY --from=build /opt/corepack /opt/corepack
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
# Next.js reads HOSTNAME to choose the address it listens on; the platform's router reaches the container on all of them.
ENV HOSTNAME=0.0.0.0 PORT=3000
# What a container does is chosen by the build target, so a platform that cannot override the start command (it only picks a Dockerfile and
# a target) still gets the right process. `web` is last, so it is what a build without a target makes. A start command given by the
# platform overrides either CMD.
FROM runtime AS worker
CMD ["pnpm", "--filter", "worker", "start"]

# The web container migrates before it serves: a migration that fails stops the container, so the previous version keeps serving. The
# migration takes a database lock, so several web containers starting together migrate once. The worker never migrates.
FROM runtime AS web
CMD ["sh", "-c", "pnpm --filter @frostbite/database migration:apply && exec node apps/web/.next/standalone/apps/web/server.js"]
