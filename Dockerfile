# Production image for the API server + web SPA. The server scrapes via a
# headed Chromium (Cloudflare's gate keys on headed-ness), so the image ships
# Xvfb and the patchright browser, and starts under a virtual display.
FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Xvfb + xauth provide the virtual display; patchright's --with-deps installs
# the Chromium shared libraries.
RUN apt-get update \
  && apt-get install -y --no-install-recommends xvfb xauth ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Install dependencies first so the layer caches across source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY desktop/package.json ./desktop/package.json
RUN pnpm install --frozen-lockfile

# patchright has no postinstall; install the headed Chromium explicitly.
RUN npx patchright install --with-deps chromium

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["bash", "scripts/start-production.sh"]
