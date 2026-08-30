# LLM Product + Retailer Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the app to discover new products and retailers using an LLM when the user searches for something not in the catalog.

**Architecture:** Server endpoint calls LLM with structured prompt, returns product + retailers. Client stores discoveries locally and merges with static catalog/distributors.

**Tech Stack:** LLM (same as price-insights), tRPC, AsyncStorage, React

---

### Task 1: Server discovery endpoint

**Files:**
- Create: `server/routers/discovery.ts`
- Modify: `server/routers.ts` (add discovery router)

- [ ] **Step 1: Read existing server infrastructure**

Read `server/price-insights.ts` to understand how LLM calls are made. Read `server/routers.ts` to understand router registration pattern.

- [ ] **Step 2: Create discovery router**

Create `server/routers/discovery.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { callLlm } from "../price-insights";

const DISCOVERY_PROMPT = `You are a product discovery assistant. Given a product search query, return a JSON object with:

1. "product": The product information
   - "name": Full product name
   - "modelNumber": Model/part number
   - "brand": Manufacturer brand
   - "category": Product category (e.g., "Headphones", "Laptop", "GPU", "Camera")
   - "description": 1-2 sentence description

2. "retailers": Array of 2-4 common retailers where this product is sold
   - "name": Retailer name
   - "website": Website URL
   - "country": Primary country
   - "currency": Currency code (USD, EUR, GBP, etc.)

Return ONLY valid JSON, no markdown fences.`;

export const discoveryRouter = router({
  discover: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const prompt = `${DISCOVERY_PROMPT}\n\nSearch query: ${input.query}`;
      const response = await callLlm(prompt);
      
      try {
        const parsed = JSON.parse(response);
        return {
          product: {
            id: `discovered-${Date.now()}`,
            name: parsed.product.name,
            modelNumber: parsed.product.modelNumber,
            brand: parsed.product.brand,
            category: parsed.product.category,
            description: parsed.product.description,
          },
          retailers: parsed.retailers.map((r: any, i: number) => ({
            id: `retailer-${Date.now()}-${i}`,
            name: r.name,
            website: r.website,
            country: r.country,
            currency: r.currency,
            region: "Global",
            countryFlag: "",
            paymentMethods: [],
            shippingCosts: {},
          })),
        };
      } catch {
        throw new Error("Failed to parse discovery response");
      }
    }),
});
```

- [ ] **Step 3: Register router in server/routers.ts**

Add `discovery: discoveryRouter` to the app router.

- [ ] **Step 4: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add server/routers/discovery.ts server/routers.ts
git commit -m "feat(server): add LLM product discovery endpoint"
```

---

### Task 2: Discovery storage helpers

**Files:**
- Create: `lib/storage/discovery.ts`
- Modify: `lib/storage/index.ts` (add exports)

- [ ] **Step 1: Read storage pattern**

Read `lib/storage/alerts.ts` to understand the storage helper pattern.

- [ ] **Step 2: Create discovery storage**

Create `lib/storage/discovery.ts`:

```typescript
import { Product, Distributor } from "../types";
import { readList, writeList } from "./utils";

const KEYS = {
  DISCOVERED_PRODUCTS: "discovered_products",
  DISCOVERED_DISTRIBUTORS: "discovered_distributors",
} as const;

export function createDiscoveryStorage() {
  async function getDiscoveredProducts(): Promise<Product[]> {
    return readList<Product>(KEYS.DISCOVERED_PRODUCTS);
  }

  async function saveDiscoveredProducts(products: Product[]): Promise<void> {
    await writeList(KEYS.DISCOVERED_PRODUCTS, products);
  }

  async function addDiscoveredProduct(product: Product): Promise<void> {
    const existing = await getDiscoveredProducts();
    if (existing.some((p) => p.id === product.id)) return;
    await saveDiscoveredProducts([...existing, product]);
  }

  async function getDiscoveredDistributors(): Promise<Distributor[]> {
    return readList<Distributor>(KEYS.DISCOVERED_DISTRIBUTORS);
  }

  async function saveDiscoveredDistributors(distributors: Distributor[]): Promise<void> {
    await writeList(KEYS.DISCOVERED_DISTRIBUTORS, distributors);
  }

  async function addDiscoveredDistributor(distributor: Distributor): Promise<void> {
    const existing = await getDiscoveredDistributors();
    if (existing.some((d) => d.id === distributor.id)) return;
    await saveDiscoveredDistributors([...existing, distributor]);
  }

  return {
    getDiscoveredProducts,
    saveDiscoveredProducts,
    addDiscoveredProduct,
    getDiscoveredDistributors,
    saveDiscoveredDistributors,
    addDiscoveredDistributor,
  };
}
```

- [ ] **Step 3: Export from storage index**

Add discovery exports to `lib/storage/index.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/storage/discovery.ts lib/storage/index.ts
git commit -m "feat(storage): add discovery storage helpers"
```

---

### Task 3: Client discovery function

**Files:**
- Create: `lib/llm-discovery.ts`

- [ ] **Step 1: Create discovery client**

Create `lib/llm-discovery.ts`:

```typescript
import { Product, Distributor } from "./types";
import { getApiBaseUrl } from "./api-base";
import { createDiscoveryStorage } from "./storage/discovery";

const storage = createDiscoveryStorage();

export async function discoverProduct(
  query: string,
): Promise<{ product: Product; retailers: Distributor[] } | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/discovery/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    
    const product: Product = {
      ...data.product,
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    
    const retailers = data.retailers.map((r: any) => ({
      ...r,
      paymentMethods: r.paymentMethods ?? [],
      shippingCosts: r.shippingCosts ?? {},
    }));
    
    await storage.addDiscoveredProduct(product);
    for (const retailer of retailers) {
      await storage.addDiscoveredDistributor(retailer);
    }
    
    return { product, retailers };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/llm-discovery.ts
git commit -m "feat: add client-side LLM discovery function"
```

---

### Task 4: Merge discovered items into catalog/distributors

**Files:**
- Modify: `lib/catalog.ts`
- Modify: `lib/distributors.ts`

- [ ] **Step 1: Update catalog.ts to merge discovered products**

Add `getAllCatalog()` function:

```typescript
import { createDiscoveryStorage } from "./storage/discovery";

const discoveryStorage = createDiscoveryStorage();

export async function getAllCatalog() {
  const discovered = await discoveryStorage.getDiscoveredProducts();
  return [...PRODUCT_CATALOG, ...discovered];
}
```

- [ ] **Step 2: Update distributors.ts to merge discovered retailers**

Add `getAllDistributors()` function:

```typescript
import { createDiscoveryStorage } from "./storage/discovery";

const discoveryStorage = createDiscoveryStorage();

export async function getAllDistributors() {
  const discovered = await discoveryStorage.getDiscoveredDistributors();
  return [...DISTRIBUTORS, ...discovered];
}
```

- [ ] **Step 3: Update searchCatalog to search merged catalog**

Change `searchCatalog` to use `getAllCatalog()`:

```typescript
export async function searchCatalogAsync(query: string) {
  const catalog = await getAllCatalog();
  const fuse = new Fuse(catalog, { /* same config */ });
  if (!query.trim()) return catalog;
  return fuse.search(query).map((result) => result.item);
}
```

Keep the sync `searchCatalog` for backwards compatibility (searches static catalog only).

- [ ] **Step 4: Commit**

```bash
git add lib/catalog.ts lib/distributors.ts
git commit -m "feat: merge discovered items into catalog and distributors"
```

---

### Task 5: Search UI — discover CTA

**Files:**
- Modify: `app/search.tsx`
- Modify: `desktop/src/components/SearchModal.tsx`

- [ ] **Step 1: Add discover state and handler to mobile search**

In `app/search.tsx`:

1. Add state: `const [discovering, setDiscovering] = useState(false);`
2. Import `discoverProduct` from `@/lib/llm-discovery`
3. Add handler:

```typescript
const handleDiscover = useCallback(async () => {
  if (!query.trim() || discovering) return;
  setDiscovering(true);
  try {
    const result = await discoverProduct(query);
    if (result) {
      loadData();
      router.push(`/product/${result.product.id}`);
    } else {
      showAlert("Discovery Failed", "Could not find product information. Try a more specific search.");
    }
  } finally {
    setDiscovering(false);
  }
}, [query, discovering, loadData, router]);
```

4. In `SearchEmptyState`, add discover button when query is non-empty:

```tsx
{query.trim().length > 0 && !discovering && (
  <TouchableOpacity onPress={handleDiscover} style={{ ... }}>
    <IconSymbol name="wand.and.stars" size={20} color={colors.primary} />
    <Text style={{ color: colors.primary }}>Discover with AI</Text>
  </TouchableOpacity>
)}
{discovering && (
  <ActivityIndicator size="small" color={colors.primary} />
)}
```

- [ ] **Step 2: Add discover to desktop SearchModal**

Same pattern in `desktop/src/components/SearchModal.tsx` — add discover button in empty state.

- [ ] **Step 3: Commit**

```bash
git add app/search.tsx desktop/src/components/SearchModal.tsx
git commit -m "feat: add AI discover button to search empty state"
```

---

### Task 6: Write tests

**Files:**
- Create: `tests/llm-discovery.test.ts`
- Create: `tests/discovery-storage.test.ts`

- [ ] **Step 1: Write discovery storage tests**

Create `tests/discovery-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
// Mock AsyncStorage and test addDiscoveredProduct, addDiscoveredDistributor,
// getDiscoveredProducts, getDiscoveredDistributors
```

- [ ] **Step 2: Write discovery client tests**

Create `tests/llm-discovery.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
// Mock fetch and test discoverProduct parsing, error handling
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/llm-discovery.test.ts tests/discovery-storage.test.ts
```

Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add tests/llm-discovery.test.ts tests/discovery-storage.test.ts
git commit -m "test: add LLM discovery and storage tests"
```

---

### Task 7: Verify full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors

- [ ] **Step 3: Run full tests**

```bash
pnpm test
```

Expected: All tests pass
