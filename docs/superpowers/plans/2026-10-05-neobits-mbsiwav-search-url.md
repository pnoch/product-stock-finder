# Neobits + MBS I-WAV Search-URL Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Neobits and MBS I-WAV return prices by correcting their search URLs to `/search?keywords=<model>` (mobile + Rust desktop parity).

**Architecture:** Two one-line `buildSearchUrl` changes plus mirrored Rust strings; the existing parsers already extract the price once the URL returns the product page.

**Tech Stack:** TypeScript, Rust, vitest, cargo.

**Spec:** `docs/superpowers/specs/2026-10-05-neobits-mbsiwav-search-url-design.md`

---

## File Structure

- Modify `lib/scrapers/neobits.ts` — `buildSearchUrl`.
- Modify `lib/scrapers/mbsiwav.ts` — `buildSearchUrl`.
- Modify `desktop/src-tauri/src/scrapers/neobits.rs` / `mbsiwav.rs` — mirror the URLs.
- Tests: `tests/scrapers/neobits.test.ts`, `tests/scrapers/mbsiwav.test.ts`.

---

### Task 1: Neobits search URL

**Files:** Modify `lib/scrapers/neobits.ts:46-47`; Modify `desktop/src-tauri/src/scrapers/neobits.rs:5-6`; Test `tests/scrapers/neobits.test.ts:13-14`

- [ ] **Step 1: Update the failing test**

In `tests/scrapers/neobits.test.ts`, replace the `buildSearchUrl` assertion:

```ts
    const url = neobitsParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://www.neobits.com/search?keywords=hAP%20ac3");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/neobits.test.ts`
Expected: FAIL — the URL still uses `search_param=all&main_search_field=`.

- [ ] **Step 3: Implement (mobile + Rust)**

In `lib/scrapers/neobits.ts`:

```ts
  buildSearchUrl: (model) =>
    `https://www.neobits.com/search?keywords=${encodeURIComponent(model)}`,
```

In `desktop/src-tauri/src/scrapers/neobits.rs`:

```rust
    let url = format!(
        "https://www.neobits.com/search?keywords={}",
        urlencoding::encode(model)
    );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scrapers/neobits.test.ts tests/desktop-scraper-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/neobits.ts desktop/src-tauri/src/scrapers/neobits.rs tests/scrapers/neobits.test.ts
git commit -m "fix(scrapers): use Neobits' /search?keywords= endpoint"
```

---

### Task 2: MBS I-WAV search URL

**Files:** Modify `lib/scrapers/mbsiwav.ts:40-41`; Modify `desktop/src-tauri/src/scrapers/mbsiwav.rs:5-6`; Test `tests/scrapers/mbsiwav.test.ts:16-17`

- [ ] **Step 1: Update the failing test**

In `tests/scrapers/mbsiwav.test.ts`, replace the `buildSearchUrl` assertion:

```ts
    const url = mbsiwavParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://www.mbsiwav.com/search?keywords=hAP%20ac3");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/mbsiwav.test.ts`
Expected: FAIL — the URL still uses `?q=`.

- [ ] **Step 3: Implement (mobile + Rust)**

In `lib/scrapers/mbsiwav.ts`:

```ts
  buildSearchUrl: (model) =>
    `https://www.mbsiwav.com/search?keywords=${encodeURIComponent(model)}`,
```

In `desktop/src-tauri/src/scrapers/mbsiwav.rs`:

```rust
    let url = format!(
        "https://www.mbsiwav.com/search?keywords={}",
        urlencoding::encode(model)
    );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scrapers/mbsiwav.test.ts tests/desktop-scraper-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/mbsiwav.ts desktop/src-tauri/src/scrapers/mbsiwav.rs tests/scrapers/mbsiwav.test.ts
git commit -m "fix(scrapers): use MBS I-WAV's /search?keywords= endpoint"
```

---

### Task 3: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0 (root tests, desktop, cargo all green).

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1107): the two URL fixes, the measured evidence (Neobits `$215.95` USD, MBS `$291.78` CAD), and the note that ROC-NOC/HellasCom remain (JS/AJAX prices; undiscovered search).

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: Neobits + MBS I-WAV search-URL fixes (Phase 1107)"
```

---

## Self-Review

- **Spec coverage:** Neobits URL (Task 1), MBS URL (Task 2), Rust parity (both tasks), verify + docs (Task 3). ROC-NOC/HellasCom are out of scope per the spec.
- **Placeholders:** none.
- **Type consistency:** `buildSearchUrl(model)` returns the `/search?keywords=` URL on both platforms; the Rust `format!` mirrors the TS template exactly.
