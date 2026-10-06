# Production Browser Runtime (headed + Xvfb) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Dockerfile that installs Chromium + Xvfb and starts the production server under a virtual display with `PSF_BROWSER_HEADED=1`, so the Phase 1106–1109 parser fixes take effect in production.

**Architecture:** A single-stage `node:20-bookworm-slim` image installs the browser + Xvfb, builds the app, and runs `scripts/start-production.sh` (Xvfb on `:99` → `node dist/index.js`). A guard test pins the invariants.

**Tech Stack:** Docker, bash, patchright, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-production-browser-runtime-design.md`

---

## File Structure

- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `scripts/start-production.sh`
- Create: `tests/production-docker.test.ts`
- Modify: `docs/releasing.md`, `docs/HANDOVER.md`

---

### Task 1: Production start script

**Files:** Create `scripts/start-production.sh`

- [ ] **Step 1: Create the script**

Create `scripts/start-production.sh`:

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

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/start-production.sh && ls -l scripts/start-production.sh`
Expected: the file has the execute bit.

- [ ] **Step 3: Commit**

```bash
git add scripts/start-production.sh
git commit -m "feat(deploy): production start script (Xvfb + headed browser)"
```

---

### Task 2: Dockerfile + .dockerignore

**Files:** Create `Dockerfile`; Create `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

Create `.dockerignore`:

```
node_modules
dist
dist-web
.git
.github
android
ios
.expo
desktop/src-tauri/target
docs
references
*.md
!README.md
```

- [ ] **Step 2: Create the Dockerfile**

Create `Dockerfile`:

```dockerfile
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
```

- [ ] **Step 3: Build the image**

Run: `docker build -t psf-prod .`
Expected: build succeeds (this is the heavy step; several minutes).

- [ ] **Step 4: Verify the runtime**

Run:
```bash
docker run --rm -d --name psf-prod-run -p 3999:3000 psf-prod
sleep 8
curl -fsS http://127.0.0.1:3999/api/health
docker rm -f psf-prod-run
```
Expected: `{"ok":true,...}`. (The server boots with `DATABASE_URL` unset; `/api/health` does not touch the DB.)

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(deploy): Dockerfile with Chromium + Xvfb for headed scraping"
```

---

### Task 3: Guard test

**Files:** Create `tests/production-docker.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/production-docker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// The production browser path only works if the image installs a headed
// browser + a display and the start script opts into headed mode. A silently
// dropped line here would make every Cloudflare-hard distributor fall back to
// plain HTTP (blocked) with no test failure.
describe("production Docker runtime", () => {
  it("installs Xvfb and the patchright browser", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");
    expect(dockerfile).toContain("xvfb");
    expect(dockerfile).toContain("patchright install");
    expect(dockerfile).toContain("scripts/start-production.sh");
  });

  it("starts under a virtual display with headed scraping enabled", async () => {
    const script = await readFile("scripts/start-production.sh", "utf8");
    expect(script).toContain("Xvfb :99");
    expect(script).toContain("export DISPLAY=:99");
    expect(script).toContain("export PSF_BROWSER_HEADED=1");
    expect(script).toContain("node dist/index.js");
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run tests/production-docker.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/production-docker.test.ts
git commit -m "test(deploy): guard the production Docker browser runtime"
```

---

### Task 4: Docs + full verification

**Files:** Modify `docs/releasing.md`, `docs/HANDOVER.md`, `todo.md`

- [ ] **Step 1: Document the deploy**

In `docs/releasing.md`, under "## 5. Web deploy", add a subsection:

```markdown
### Container deploy (Railway)

The repo ships a `Dockerfile`; Railway builds it in preference to Nixpacks.
The image installs Chromium + Xvfb and starts the server via
`scripts/start-production.sh`, which runs Xvfb on `:99` and sets
`PSF_BROWSER_HEADED=1`. Headed Chromium is required: Cloudflare's gate keys on
headed-ness, so headless returns 403 for Winncom/B&H (see Phase 1106). Ensure
the Railway service is connected to the GitHub repo (not a bare image) so the
Dockerfile is built on deploy.
```

In `docs/HANDOVER.md` §3 (Railway production), add a line noting the `app`
service now builds from the repo `Dockerfile` (headed browser runtime).

- [ ] **Step 2: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 3: Document the phase**

Add a `todo.md` phase entry (next number 1110): the Dockerfile + Xvfb + headed start, the local container verification, and the honest note that live Railway verification needs dashboard access.

- [ ] **Step 4: Commit**

```bash
git add docs/releasing.md docs/HANDOVER.md todo.md
git commit -m "docs: production browser runtime (Phase 1110)"
```

---

## Self-Review

- **Spec coverage:** start script (Task 1), Dockerfile + .dockerignore (Task 2), guard test (Task 3), docs + verify (Task 4).
- **Placeholders:** none.
- **Consistency:** the script path `scripts/start-production.sh` is referenced identically in the Dockerfile, the guard test, and the docs; `PSF_BROWSER_HEADED`/`DISPLAY` match `lib/scrapers/browser.ts`.
- **Honest limit:** the live Railway switch is documented, not automated (no dashboard access).
