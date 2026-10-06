# Production Browser Runtime (headed + Xvfb) — Design Spec

**Date:** 2026-10-05
**Goal:** Make the production server actually run the headed browser path so the Phase 1106–1109 parser fixes take effect, by shipping a Dockerfile that installs Chromium + Xvfb and starts the server under a virtual display.

## Problem

Phases 1106–1109 fixed the parsers and proved that Cloudflare's gate keys on **headed-ness** (Winncom/B&H return 403 headless, 200 headed). But the production server (Railway, Nixpacks) cannot exercise that path:

- **No browser installed.** `npx patchright install` runs only in CI (`.github/workflows/ci.yml:60`). Nixpacks runs `pnpm build` with no browser install, so `chromium.launch()` fails and every browser-required distributor falls back to plain HTTP → blocked.
- **No display.** `PSF_BROWSER_HEADED=1` needs an X server; nothing in the deploy provides one.
- **No deploy config in-repo.** There is no `Dockerfile`/`nixpacks.toml`; the Railway service is configured in the dashboard, so the runtime is not reproducible or reviewable.

Verified locally in a clean `node:20-bookworm-slim` container: with `xvfb` + `xauth` installed and `npx patchright install --with-deps chromium`, a headed `chromium.launch({ headless: false })` under `DISPLAY=:99` loads a page (`HEADED_OK status=200`). **`xvfb-run -a` hangs in the slim image** (it works without `-a`, but the direct `Xvfb :99 & DISPLAY=:99` form is the reliable one).

## Scope

**In scope:** a `Dockerfile` (Railway auto-detects it over Nixpacks), a `.dockerignore`, a production start script that launches Xvfb then the server with `PSF_BROWSER_HEADED=1`, a guard test, and docs.

**Out of scope:** changing the parser/browser code (already correct); the Railway dashboard wiring (documented, not codeable here); the managed-provider key (separate, user-supplied).

## Architecture

### 1. `Dockerfile` (single-stage, `node:20-bookworm-slim`)

1. Install `xvfb`, `xauth`, and the Chromium shared-library deps.
2. `corepack enable && corepack prepare pnpm@9.12.0`.
3. `pnpm install --frozen-lockfile` (devDeps needed: `esbuild`, `expo`).
4. `npx patchright install --with-deps chromium` (installs the headed Chromium, not just headless-shell).
5. Copy the source, `pnpm build` (esbuild server bundle + `expo export` web).
6. `CMD ["bash", "scripts/start-production.sh"]`.

A single stage keeps the runtime `node_modules` (the esbuild bundle is `--packages=external`, so the server imports `patchright`/`impit` at runtime) without a fragile copy step.

### 2. `scripts/start-production.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
# Headed Chromium needs an X server. `xvfb-run -a` hangs in bookworm-slim, so
# start Xvfb directly and export DISPLAY.
Xvfb :99 -screen 0 1280x720x24 >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!
trap 'kill "$XVFB_PID" 2>/dev/null || true' EXIT
# Wait for the display socket before launching the server.
for _ in $(seq 1 50); do
  [ -S /tmp/.X11-unix/X99 ] && break
  sleep 0.1
done
export DISPLAY=:99
export PSF_BROWSER_HEADED=1
exec node dist/index.js
```

`NODE_ENV=production` is set by the existing `pnpm start`; the Dockerfile sets it via `ENV`.

### 3. `.dockerignore`

Exclude `node_modules`, `dist`, `dist-web`, `.git`, `android`, `ios`, `.expo`, `desktop/src-tauri/target`, and the docs — so the build context stays small and the image installs fresh.

### 4. Guard test — `tests/production-docker.test.ts`

Pin the invariants that make the runtime work: the Dockerfile installs `xvfb` + `patchright install`, the start script exports `PSF_BROWSER_HEADED=1` and `DISPLAY`, and the Dockerfile's `CMD` points at the script. This mirrors `tests/ci-workflow.test.ts`.

## Data Flow

1. Railway builds the Dockerfile → image with Chromium + Xvfb + the built server.
2. Container starts → `start-production.sh` → Xvfb on `:99` → `node dist/index.js` with `PSF_BROWSER_HEADED=1`.
3. `prices.get` → `resilientFetch` → `launchBrowser()` reads `PSF_BROWSER_HEADED=1` → headed Chromium → Cloudflare-hard sites return 200.

## Error Handling

- If Xvfb fails to start, the server still boots (headless fallback) — the browser path degrades to today's behavior rather than crashing.
- The `trap` kills Xvfb on exit.

## Security & Privacy

No new data flows. The image runs as root by default (Railway's convention); no secrets are baked in — env comes from the platform.

## Testing

- `tests/production-docker.test.ts` — source guards (above).
- Local: `docker build` + `docker run` the image and confirm `/api/health` returns 200 and a headed scrape succeeds. (The full build is heavy; the runtime half is already proven in a scratch container.)

## Risks & Mitigations

- **Image size / build time** — single-stage with devDeps is larger; acceptable for a small app, and simpler than a fragile multi-stage copy.
- **`xvfb-run -a` hang** — avoided; the script starts Xvfb directly.
- **Railway still on Nixpacks** — Railway prefers a `Dockerfile` when present; documented in `docs/releasing.md`/`HANDOVER.md` so the switch is explicit.
- **Cannot verify against live Railway** — no dashboard access; verification is the local container + the guard test, documented honestly.

## Success Criteria

- The Docker image builds and its container serves `/api/health` 200.
- A headed scrape works inside the container (`PSF_BROWSER_HEADED=1` + Xvfb).
- `pnpm verify` stays green.
