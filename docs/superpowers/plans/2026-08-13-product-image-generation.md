# Product Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `images.get` tRPC endpoint that generates a product thumbnail for a catalog product via the scaffolded `generateImage` module, caches the URL (no TTL), and displays it on the watchlist, search, and product-detail screens on both mobile and desktop, with a background pre-generate pass in the warmer.

**Architecture:** A new `server/product-images.ts` builds a prompt from the product, calls `generateImage` from `server/_core/imageGeneration.ts`, and caches the URL in a new `product_images` Drizzle table (with in-memory Map fallback). `server/routers.ts` exposes `images.get`. The warmer tick (Phase 29) gains a bounded `warmProductImages` pass. Mobile (`lib/server-images.ts` + three screens) and desktop (Rust command + three pages) fetch and render the image, falling back to a placeholder.

**Tech Stack:** Express + tRPC v11 + Drizzle (MySQL) + superjson; `server/_core/imageGeneration.ts` (generateImage); React Native (mobile); Tauri/Rust (desktop); vitest; cargo test.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `drizzle/schema.ts` | Add `product_images` table + row types |
| `drizzle/0005_*.sql` | Generated migration |
| `server/product-images.ts` | Image generation + cache (DB + memory fallback) |
| `server/routers.ts` | Add `images.get` public procedure |
| `server/prices.ts` | Add `warmProductImages` + `IMAGES_PER_TICK` in the warmer tick |
| `lib/server-images.ts` | Mobile client helper `fetchProductImage` |
| `app/(tabs)/watchlist.tsx` | Display product image on watchlist cards |
| `app/search.tsx` | Display product image on search results |
| `app/product/[id].tsx` | Display product image on detail header |
| `desktop/src-tauri/src/lib.rs` | `fetch_product_image` command |
| `desktop/src/pages/Watchlist.tsx`, `Search.tsx`, `ProductDetail.tsx` | Display product image |
| `tests/product-images.test.ts` | Image generation + cache tests |
| `tests/images-router.test.ts` | Router tests |
| `tests/server-images.test.ts` | Mobile helper tests |

---

### Task 1: `product_images` Drizzle table + migration

**Files:**
- Modify: `drizzle/schema.ts`
- Test: `drizzle/0005_*.sql` (generated)

- [ ] **Step 1: Add `product_images` table to `drizzle/schema.ts`**

Add at the end of the file (after `InsertPriceInsightsRow`, line ~140):

```ts
export const productImages = mysqlTable("product_images", {
  productId: varchar("productId", { length: 128 }).notNull().primaryKey(),
  imageUrl: text("imageUrl").notNull(),
});

export type ProductImagesRow = typeof productImages.$inferSelect;
export type InsertProductImagesRow = typeof productImages.$inferInsert;
```

No new imports needed — `varchar`, `text`, `mysqlTable` are all already imported.

- [ ] **Step 2: Generate the migration**

Run:

```bash
DATABASE_URL="mysql://localhost:3306/product_stock_finder" pnpm exec drizzle-kit generate
```

Expected: writes `drizzle/0005_*.sql` containing `CREATE TABLE \`product_images\`` with `productId` as primary key, plus updated `drizzle/meta/_journal.json` and `drizzle/meta/0005_snapshot.json`. (This command only reads `drizzle/schema.ts` and writes SQL — it does not connect to a live DB.)

- [ ] **Step 3: Verify types**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0005_*.sql drizzle/meta/
git commit -m "feat(sync): add product_images table"
```

---

### Task 2: Image generation + cache — `server/product-images.ts`

**Files:**
- Create: `server/product-images.ts`
- Test: `tests/product-images.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/product-images.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

import { generateImage } from "../server/_core/imageGeneration";
import {
  getProductImage,
  listProductsMissingImage,
  clearImagesForTests,
} from "../server/product-images";

const mockedGenerateImage = vi.mocked(generateImage);

describe("getProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearImagesForTests();
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/crs804.png",
    });
  });

  it("generates and caches an image on first call", async () => {
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("returns the cached image on a second call without regenerating", async () => {
    await getProductImage("mikrotik-crs804-4ddq-hrm");
    const second = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(second).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("returns null when the product is not in the catalog", async () => {
    const result = await getProductImage("unknown-product");
    expect(result).toBeNull();
    expect(mockedGenerateImage).not.toHaveBeenCalled();
  });

  it("returns null when generation fails", async () => {
    mockedGenerateImage.mockRejectedValue(new Error("gen failed"));
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toBeNull();
  });
});

describe("listProductsMissingImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearImagesForTests();
  });

  it("returns all catalog products when none have images", async () => {
    const missing = await listProductsMissingImage();
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).toContain("mikrotik-crs804-4ddq-hrm");
  });

  it("excludes products that already have an image", async () => {
    mockedGenerateImage.mockResolvedValue({ url: "https://img.example.com/x.png" });
    await getProductImage("mikrotik-crs804-4ddq-hrm");
    const missing = await listProductsMissingImage();
    expect(missing).not.toContain("mikrotik-crs804-4ddq-hrm");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/product-images.test.ts`
Expected: FAIL with "Cannot find module '../server/product-images'".

- [ ] **Step 3: Write `server/product-images.ts`**

Create `server/product-images.ts`:

```ts
import { eq } from "drizzle-orm";
import { productImages, type ProductImagesRow } from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../lib/catalog";
import { getDb } from "./db";
import { generateImage } from "./_core/imageGeneration";
import type { Product } from "../lib/types";

const memoryImages = new Map<string, string>();

export interface ProductImage {
  imageUrl: string;
}

export async function getProductImage(
  productId: string,
): Promise<ProductImage | null> {
  const cached = await readCached(productId);
  if (cached) return { imageUrl: cached };
  const product = PRODUCT_CATALOG.find((p) => p.id === productId);
  if (!product) return null;
  const url = await generateImageForProduct(product);
  if (!url) return null;
  await writeCached(productId, url);
  return { imageUrl: url };
}

async function readCached(productId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) {
    return memoryImages.get(productId) ?? null;
  }
  const rows = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .limit(1);
  return rows.length > 0 ? rows[0]!.imageUrl : null;
}

async function writeCached(productId: string, url: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryImages.set(productId, url);
    return;
  }
  await db
    .insert(productImages)
    .values({ productId, imageUrl: url })
    .onDuplicateKeyUpdate({ set: { imageUrl: url } });
}

function buildImagePrompt(product: {
  name: string;
  brand: string;
  category: string;
}): string {
  return `A ${product.brand} ${product.name} ${product.category.toLowerCase()}, product photo, clean background, high detail`;
}

async function generateImageForProduct(
  product: Product,
): Promise<string | null> {
  try {
    const result = await generateImage({ prompt: buildImagePrompt(product) });
    return result.url ?? null;
  } catch {
    return null;
  }
}

export async function listProductsMissingImage(): Promise<string[]> {
  const missing: string[] = [];
  for (const product of PRODUCT_CATALOG) {
    const cached = await readCached(product.id);
    if (!cached) missing.push(product.id);
  }
  return missing;
}

export function clearImagesForTests(): void {
  memoryImages.clear();
}
```

> **Note:** `listProductsMissingImage` reads the cache for each catalog product and returns those without an image. It does not need `getDb` directly — `readCached` handles the DB internally.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/product-images.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/product-images.ts tests/product-images.test.ts
git commit -m "feat(server): add product image generation with URL cache"
```

---

### Task 3: Router — `images.get`

**Files:**
- Modify: `server/routers.ts`
- Test: `tests/images-router.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/images-router.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/product-images", () => ({
  getProductImage: vi.fn(),
  listProductsMissingImage: vi.fn(),
  clearImagesForTests: vi.fn(),
}));

import { getProductImage } from "../server/product-images";
const mockedGetProductImage = vi.mocked(getProductImage);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
  };
}

describe("images router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the product image URL", async () => {
    mockedGetProductImage.mockResolvedValue({
      imageUrl: "https://img.example.com/crs804.png",
    });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.images.get({ productId: "mikrotik-crs804-4ddq-hrm" });
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGetProductImage).toHaveBeenCalledWith("mikrotik-crs804-4ddq-hrm");
  });

  it("returns null when there is no image", async () => {
    mockedGetProductImage.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.images.get({ productId: "unknown" });
    expect(result).toBeNull();
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetProductImage.mockResolvedValue({ imageUrl: "x" });
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.images.get({ productId: "a" }),
    ).resolves.toEqual({ imageUrl: "x" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/images-router.test.ts`
Expected: FAIL with "caller.images is undefined".

- [ ] **Step 3: Add the `images` router to `server/routers.ts`**

Add the import (after the `getInsight` import, line 15):

```ts
import { getProductImage } from "./product-images";
```

Add the `images` router to `appRouter` (after the `insights` router block, before the closing `});`):

```ts
  images: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getProductImage(input.productId);
      }),
  }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/images-router.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify types + full test suite**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/images-router.test.ts tests/insights-router.test.ts tests/prices-router.test.ts tests/sync-router.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts tests/images-router.test.ts
git commit -m "feat(server): add public images.get tRPC endpoint"
```

---

### Task 4: Background pre-generate — `warmProductImages` in the warmer

**Files:**
- Modify: `server/prices.ts`
- Test: `tests/prices.test.ts`

- [ ] **Step 1: Update the failing tests in `tests/prices.test.ts`**

The current file is at `/home/pnoch/Development/product-stock-finder/tests/prices.test.ts` (176 lines). Read it first. It mocks `../lib/scrapers/registry`, `../lib/scrapers/utils`, `../server/price-cache`, `../server/price-history`, and imports `getPrice, PRICE_TTL_MS, warmCatalogRotation` from `../server/prices`.

Add a mock for `../server/product-images` (near the other `vi.mock` calls):

```ts
vi.mock("../server/product-images", () => ({
  getProductImage: vi.fn(),
  listProductsMissingImage: vi.fn(),
  clearImagesForTests: vi.fn(),
}));
```

Add `warmProductImages` to the `../server/prices` import. Current (line 33):

```ts
import { getPrice, PRICE_TTL_MS, warmCatalogRotation } from "../server/prices";
```

Change to:

```ts
import { getPrice, PRICE_TTL_MS, warmCatalogRotation, warmProductImages } from "../server/prices";
```

Add a new `describe` block at the end of the file:

```ts
describe("warmProductImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when there are no missing images", async () => {
    const { listProductsMissingImage } = await import("../server/product-images");
    vi.mocked(listProductsMissingImage).mockResolvedValue([]);
    const warmed = await warmProductImages(2);
    expect(warmed).toBe(0);
  });
});
```

> **Note:** `warmProductImages` calls `listProductsMissingImage()` (mocked) and, for each missing product, `getProductImage` (mocked). With an empty missing list, it returns 0 without calling `getProductImage`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: FAIL with "warmProductImages is not exported".

- [ ] **Step 3: Modify `server/prices.ts`**

Add the import (after the `./catalog-warmer` import, line 10):

```ts
import { getProductImage, listProductsMissingImage } from "./product-images";
```

Add the constant (after `CATALOG_WARM_PER_TICK`, line 14):

```ts
const IMAGES_PER_TICK = 2;
```

Add `warmProductImages` after `warmCatalogRotation` (after line 96):

```ts
export async function warmProductImages(count: number): Promise<number> {
  const missing = await listProductsMissingImage();
  const toGenerate = missing.slice(0, count);
  for (const productId of toGenerate) {
    await getProductImage(productId);
  }
  return toGenerate.length;
}
```

Change the warmer tick (lines 104-108) to call it. Current:

```ts
  warmerTimer = setInterval(() => {
    void refreshNearExpiry(Date.now());
    void warmCatalogRotation(CATALOG_WARM_PER_TICK);
    void purgeOldHistory(Date.now());
  }, intervalMs);
```

Change to:

```ts
  warmerTimer = setInterval(() => {
    void refreshNearExpiry(Date.now());
    void warmCatalogRotation(CATALOG_WARM_PER_TICK);
    void warmProductImages(IMAGES_PER_TICK);
    void purgeOldHistory(Date.now());
  }, intervalMs);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/prices.test.ts`
Expected: PASS (9 tests — 8 existing + 1 new).

- [ ] **Step 5: Verify types + full test suite**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm exec vitest run tests/prices.test.ts tests/warmer.test.ts tests/catalog-warmer.test.ts tests/product-images.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/prices.ts tests/prices.test.ts
git commit -m "feat(server): pre-generate product images in the warmer"
```

---

### Task 5: Mobile client helper — `lib/server-images.ts`

**Files:**
- Create: `lib/server-images.ts`
- Test: `tests/server-images.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server-images.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchProductImage } from "../lib/server-images";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockClientQuery(query: Mock) {
  mockedCreateClient.mockReturnValue({
    images: { get: { query } },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchProductImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the image URL from the server", async () => {
    const query = vi.fn().mockResolvedValue({
      imageUrl: "https://img.example.com/crs804.png",
    });
    mockClientQuery(query);
    const result = await fetchProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(query).toHaveBeenCalledWith({ productId: "mikrotik-crs804-4ddq-hrm" });
  });

  it("returns null when the server returns null", async () => {
    const query = vi.fn().mockResolvedValue(null);
    mockClientQuery(query);
    expect(await fetchProductImage("x")).toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const query = vi.fn().mockRejectedValue(new Error("network"));
    mockClientQuery(query);
    expect(await fetchProductImage("x")).toBeNull();
  });

  it("returns null when the query times out", async () => {
    const query = vi.fn().mockImplementation(
      () =>
        new Promise<{ imageUrl: string }>((resolve) =>
          setTimeout(() => resolve({ imageUrl: "x" }), 10_000),
        ),
    );
    mockClientQuery(query);
    expect(await fetchProductImage("x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/server-images.test.ts`
Expected: FAIL with "Cannot find module '../lib/server-images'".

- [ ] **Step 3: Write `lib/server-images.ts`**

Create `lib/server-images.ts`:

```ts
import { createTRPCClient } from "./trpc";

const TIMEOUT_MS = 4000;

export interface ProductImage {
  imageUrl: string;
}

export async function fetchProductImage(
  productId: string,
): Promise<ProductImage | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.images.get.query({ productId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return result;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/server-images.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server-images.ts tests/server-images.test.ts
git commit -m "feat(mobile): add fetchProductImage client helper"
```

---

### Task 6: Mobile display — watchlist, search, product detail

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`
- Modify: `app/search.tsx`
- Modify: `app/product/[id].tsx`

This is a UI change (no new tests). Each screen renders the product image via `fetchProductImage`, falling back to the existing placeholder/icon when null.

- [ ] **Step 1: Add the import to each file**

In `app/(tabs)/watchlist.tsx`, `app/search.tsx`, and `app/product/[id].tsx`, add:

```ts
import { fetchProductImage } from "@/lib/server-images";
```

- [ ] **Step 2: Watchlist card — `app/(tabs)/watchlist.tsx`**

The watchlist card is a component (around line 120-160). Add image state + fetch. In the card component, add:

```ts
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchProductImage(product.id).then((res) => {
      if (active && res) setImageUrl(res.imageUrl);
    });
    return () => {
      active = false;
    };
  }, [product.id]);
```

Render the image at the top of the card (before the text block, inside the row `View`). Add a 48x48 rounded image when `imageUrl` is set:

```tsx
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 48, height: 48, borderRadius: 8, marginRight: 10 }}
        />
      )}
```

> **Note:** import `Image` from `react-native` if not already imported. Match the file's inline-style convention. Place the image so it reads naturally (e.g. as the first element in the card's row layout).

- [ ] **Step 3: Search results — `app/search.tsx`**

The search result row is rendered in `renderItem` (around line 178-217). Add image state + fetch. Since `renderItem` is a function, add a small `ProductImage` component or inline the fetch. Simplest: add a `ProductImage` component at the top of the file:

```tsx
function ProductImage({ productId }: { productId: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchProductImage(productId).then((res) => {
      if (active && res) setImageUrl(res.imageUrl);
    });
    return () => {
      active = false;
    };
  }, [productId]);
  if (!imageUrl) return null;
  return (
    <Image
      source={{ uri: imageUrl }}
      style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }}
    />
  );
}
```

Render it in the search result row (before the text block, inside the row `View`):

```tsx
            <ProductImage productId={item.id} />
```

> **Note:** import `Image`, `useState`, `useEffect` from `react-native`/`react` if not already imported. Match the file's inline-style convention.

- [ ] **Step 4: Product detail header — `app/product/[id].tsx`**

The product detail screen already has `insight` state (from Phase 30). Add image state + fetch. Add state near the other `useState` (e.g. after `const [insight, setInsight] = useState<string | null>(null);`):

```ts
  const [productImage, setProductImage] = useState<string | null>(null);
```

In the `loadData` callback (around line 422), after the insight fetch, add:

```ts
      void fetchProductImage(id).then((res) => {
        if (res) setProductImage(res.imageUrl);
      });
```

Render the image in the header area (near the product name). Add:

```tsx
      {productImage && (
        <Image
          source={{ uri: productImage }}
          style={{ width: 96, height: 96, borderRadius: 12, marginBottom: 12 }}
        />
      )}
```

> **Note:** import `Image` from `react-native` if not already imported. Match the file's inline-style convention. Place the image near the product name/header.

- [ ] **Step 5: Verify types**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/watchlist.tsx app/search.tsx app/product/[id].tsx
git commit -m "feat(mobile): show product images on watchlist, search, and detail"
```

---

### Task 7: Desktop — `fetch_product_image` command + display

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src/pages/Watchlist.tsx`
- Modify: `desktop/src/pages/Search.tsx`
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add the `fetch_product_image` command in Rust**

In `desktop/src-tauri/src/lib.rs`, add a new command (near `fetch_price_insight`). Add it after the `fetch_price_insight` function:

```rust
#[tauri::command]
async fn fetch_product_image(api_base_url: String, product_id: String) -> Result<Option<serde_json::Value>, String> {
    if api_base_url.is_empty() {
        return Ok(None);
    }
    let input = serde_json::json!({
        "json": { "productId": product_id }
    });
    let url = format!(
        "{}/api/trpc/images.get?input={}",
        api_base_url.trim_end_matches('/'),
        urlencoding::encode(&input.to_string())
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(None);
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let data = body.pointer("/result/data/json");
    match data {
        Some(v) if !v.is_null() => Ok(Some(v.clone())),
        _ => Ok(None),
    }
}
```

- [ ] **Step 2: Register the command**

Add `fetch_product_image` to the `generate_handler!` list (after `fetch_price_insight`):

```rust
            fetch_price_insight,
            fetch_product_image,
```

- [ ] **Step 3: Display the image in the desktop pages**

For each of `desktop/src/pages/Watchlist.tsx`, `Search.tsx`, and `ProductDetail.tsx`, add a small reusable fetch + render. Add a shared helper component or inline the fetch. The simplest is a `ProductImage` component. Create `desktop/src/components/ProductImage.tsx`:

```tsx
import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../lib/api-base";

export function ProductImage({ productId, size = 48 }: { productId: string; size?: number }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const base = getApiBaseUrl();
    if (!base) return;
    const { invoke } = require("@tauri-apps/api/core");
    invoke("fetch_product_image", { apiBaseUrl: base, productId })
      .then((res: any) => {
        if (active && res && res.imageUrl) setImageUrl(res.imageUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId]);
  if (!imageUrl) return null;
  return (
    <img
      src={imageUrl}
      alt=""
      style={{ width: size, height: size, borderRadius: 8, marginRight: 10, objectFit: "cover" }}
    />
  );
}
```

> **Note:** use `import { invoke } from "@tauri-apps/api/core"` at the top of the file instead of `require` if the project uses ESM imports (check the existing pages — they use `import`). Match the existing import style.

Then render `<ProductImage productId={product.id} />` in each page's product row/card, and `<ProductImage productId={product.id} size={96} />` on the product detail header.

- [ ] **Step 4: Verify Rust compiles and tests pass**

Run: `cargo test` in `desktop/src-tauri`
Expected: PASS (existing tests compile and pass).

- [ ] **Step 5: Verify desktop typecheck + tests**

Run: `pnpm check:desktop`
Expected: PASS.

Run: `pnpm --filter desktop test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src-tauri/src/lib.rs desktop/src/components/ProductImage.tsx desktop/src/pages/Watchlist.tsx desktop/src/pages/Search.tsx desktop/src/pages/ProductDetail.tsx
git commit -m "feat(desktop): show product images on watchlist, search, and detail"
```

---

### Task 8: Final verification + checkpoint commit

**Files:**
- Whole repo
- Modify: `todo.md`

- [ ] **Step 1: Run all verification gates**

```bash
pnpm check
pnpm lint
pnpm test
pnpm check:desktop
pnpm --filter desktop test
```

And in `desktop/src-tauri`: `cargo test`

Expected: all PASS.

- [ ] **Step 2: Update `todo.md`**

Append a Phase 31 entry after the Phase 30 block:

```markdown
## Phase 31: Product Image Generation

- [x] product_images Drizzle table + migration
- [x] Server image generation + URL cache (server/product-images.ts)
- [x] Public images.get tRPC endpoint
- [x] Background pre-generate in the warmer
- [x] Mobile fetchProductImage helper + watchlist/search/detail display
- [x] Desktop fetch_product_image command + watchlist/search/detail display
```

- [ ] **Step 3: Checkpoint commit**

```bash
git add -A
git commit -m "Checkpoint: v3.10: Product image generation (server-generated thumbnails from catalog, cached, shown on watchlist/search/detail, background pre-generate). TypeScript: 0 errors."
```

Use the next version number per the repo's existing checkpoint history (current latest is v3.9).

---

## Self-Review Notes (from planning)

- **Spec coverage:** Every spec section maps to a task: `product_images` table (T1), image generation + cache (T2), `images.get` router (T3), background pre-generate (T4), mobile helper (T5), mobile display (T6), desktop command + display (T7), verification (T8). Out-of-scope items (voice, Data API, notifications, file-storage upload, image editing, client-side generation) are untouched.
- **Type consistency:** `ProductImage` defined in both `server/product-images.ts` and `lib/server-images.ts` (same shape `{ imageUrl }`). `getProductImage(productId)` signature consistent across the service, router, and client helper. `fetchProductImage(productId)` matches. `warmProductImages(count)` consistent across the test and the warmer-tick call.
- **`listProductsMissingImage`:** Task 2's implementation does not import `getDb` directly — it uses `readCached` (which handles the DB internally), so there's no unused-import issue.
- **Desktop command signature:** `fetch_product_image(api_base_url, product_id)` — the JS side passes `apiBaseUrl` and `productId` (Tauri auto-converts camelCase JS args to snake_case Rust params). The `ProductImage` component uses `import { invoke }` (ESM) to match the existing pages.
- **UI display is additive:** each screen falls back to its existing placeholder/icon when the image is null, so no existing layout breaks.