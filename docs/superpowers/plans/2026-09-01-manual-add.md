# Manual Add with LLM-Assisted Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users paste free text to add any product — LLM cleans it into the product template, user reviews/edits, and distributor listings are auto-discovered.

**Architecture:** Server `parseProductText` (injectable `invokeLLM`, structured JSON output) exposed via new `products.parse` tRPC endpoint; client `discoverListings` reuses `fetchServerPrice` across all parsers; `ManualAddSheet` two-step bottom sheet (paste → review) wired into the Search screen.

**Tech Stack:** tRPC v11, Zod, TypeScript strict, vitest, React Native.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `server/product-parse.ts` | `parseProductText` (LLM prompt + validation) |
| `server/routers.ts` | `products.parse` endpoint |
| `lib/server-product-parse.ts` | tRPC wrapper with timeout |
| `lib/listing-discovery.ts` | `discoverListings` + `customProductSlug` |
| `tests/product-parse.test.ts` | Validation layer (mocked LLM) |
| `tests/listing-discovery.test.ts` | Discovery mapping (mocked fetch) |
| `components/search/manual-add-sheet.tsx` | Two-step sheet |
| `app/search.tsx` | Header button + sheet wiring |

**Key existing patterns:** `invokeLLM({ messages, maxTokens })` returns `{ choices: [{ message: { content } }] }` (see `server/price-insights.ts` generateInsight); tRPC wrappers use `createTRPCClient()` + 4s timeout race (see `lib/server-insights.ts`); `fetchServerPrice(distributorId, modelNumber)` returns `{ snapshot, history } | null`; `getAllParserIds()` from `@/lib/scrapers/registry`.

---

## Task 1: Server parse module + endpoint

**Files:**
- Create: `server/product-parse.ts`
- Modify: `server/routers.ts`
- Test: `tests/product-parse.test.ts`

- [ ] **Step 1: Write failing test `tests/product-parse.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { parseProductText } from "../server/product-parse";

function llmReturning(content: string | null) {
  return vi.fn().mockResolvedValue({
    choices: content === null ? [] : [{ message: { content } }],
  });
}

describe("parseProductText", () => {
  it("extracts and trims fields from LLM JSON output", async () => {
    const llm = llmReturning(
      JSON.stringify({
        name: "  MikroTik CRS326 Switch ",
        modelNumber: "CRS326-24S+2Q+RM",
        brand: "MikroTik",
        category: "Networking Switch",
        description: "  24-port switch.  ",
      }),
    );
    const result = await parseProductText("crs326 switch 24 port", llm);
    expect(result).toEqual({
      name: "MikroTik CRS326 Switch",
      modelNumber: "CRS326-24S+2Q+RM",
      brand: "MikroTik",
      category: "Networking Switch",
      description: "24-port switch.",
    });
    expect(llm).toHaveBeenCalledOnce();
  });

  it("fills defaults for missing optional fields", async () => {
    const llm = llmReturning(
      JSON.stringify({ name: "Widget", modelNumber: "W-1" }),
    );
    const result = await parseProductText("widget w-1", llm);
    expect(result).toEqual({
      name: "Widget",
      modelNumber: "W-1",
      brand: "",
      category: "Other",
      description: "",
    });
  });

  it("returns null when name or modelNumber missing", async () => {
    const llm = llmReturning(JSON.stringify({ name: "No Model" }));
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("returns null on non-JSON LLM output", async () => {
    const llm = llmReturning("sure thing, here you go");
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    const llm = vi.fn().mockRejectedValue(new Error("no api key"));
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("truncates over-long fields", async () => {
    const llm = llmReturning(
      JSON.stringify({
        name: "N".repeat(300),
        modelNumber: "M".repeat(200),
        brand: "B".repeat(200),
        category: "C".repeat(200),
        description: "D".repeat(2000),
      }),
    );
    const result = await parseProductText("x", llm)!;
    expect(result!.name.length).toBe(200);
    expect(result!.modelNumber.length).toBe(100);
    expect(result!.brand.length).toBe(100);
    expect(result!.category.length).toBe(100);
    expect(result!.description.length).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/product-parse.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `server/product-parse.ts`**

```typescript
import { invokeLLM } from "./_core/llm";

export interface ParsedProduct {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

type LlmInvoke = typeof invokeLLM;

const LIMITS = {
  name: 200,
  modelNumber: 100,
  brand: 100,
  category: 100,
  description: 1000,
};

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

// Extracts a product template from messy free text. Returns null when the
// LLM is unavailable or its output is unusable — callers fall back to manual
// entry.
export async function parseProductText(
  raw: string,
  invoke: LlmInvoke = invokeLLM,
): Promise<ParsedProduct | null> {
  try {
    const result = await invoke({
      messages: [
        {
          role: "system",
          content:
            "You extract structured product data for an electronics stock tracker. " +
            "From the user's messy text (a model number, product name, or spec-sheet " +
            "paragraph), return ONLY a JSON object with keys: name (human-readable " +
            "product name), modelNumber (exact manufacturer model/part number — " +
            "preserve case and punctuation), brand, category (e.g. 'Networking " +
            "Switch', 'Router', 'Access Point'), description (1-2 factual sentences). " +
            "Never invent a model number; if the text contains none, omit it.",
        },
        { role: "user", content: raw.slice(0, 2000) },
      ],
      maxTokens: 400,
    });
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    const name = clean(parsed.name, LIMITS.name);
    const modelNumber = clean(parsed.modelNumber, LIMITS.modelNumber);
    if (!name || !modelNumber) return null;

    return {
      name,
      modelNumber,
      brand: clean(parsed.brand, LIMITS.brand),
      category: clean(parsed.category, LIMITS.category) || "Other",
      description: clean(parsed.description, LIMITS.description),
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/product-parse.test.ts` — PASS.

- [ ] **Step 5: Add the router endpoint**

In `server/routers.ts`:

1. Import: `import { parseProductText } from "./product-parse";`
2. Add a `products` router alongside the existing ones (e.g. after `images`):

```typescript
  products: router({
    parse: publicProcedure
      .input(z.object({ raw: z.string().min(1).max(2000) }))
      .query(async ({ input }) => {
        return { product: await parseProductText(input.raw) };
      }),
  }),
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

```bash
git add server/product-parse.ts server/routers.ts tests/product-parse.test.ts && git commit -m "feat: add server-side product text parsing via LLM"
```

---

## Task 2: Client discovery + tRPC wrapper

**Files:**
- Create: `lib/listing-discovery.ts`
- Create: `lib/server-product-parse.ts`
- Test: `tests/listing-discovery.test.ts`

- [ ] **Step 1: Write failing test `tests/listing-discovery.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import {
  customProductSlug,
  discoverListings,
} from "../lib/listing-discovery";
import type { ServerPriceResult } from "../lib/types";

const NOW = 1_750_000_000_000;

function snapshotResult(
  overrides: Partial<ServerPriceResult["snapshot"]> = {},
): ServerPriceResult {
  return {
    snapshot: {
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com/p",
      ...overrides,
    },
    history: [],
  } as ServerPriceResult;
}

describe("customProductSlug", () => {
  it("normalizes model numbers into ids", () => {
    expect(customProductSlug("CRS326-24S+2Q+RM")).toBe(
      "custom-crs326-24s-2q-rm",
    );
    expect(customProductSlug("  hAP  ax²  ")).toBe("custom-hap-ax");
  });
});

describe("discoverListings", () => {
  it("maps snapshots to listings and skips misses", async () => {
    const fetchPrice = vi.fn(async (distributorId: string) =>
      distributorId === "hit-a" || distributorId === "hit-b"
        ? snapshotResult({ price: distributorId === "hit-a" ? 90 : 110 })
        : null,
    );
    const listings = await discoverListings("MODEL", {
      parserIds: ["miss-1", "hit-a", "miss-2", "hit-b"],
      fetchPrice,
      now: NOW,
    });
    expect(listings).toHaveLength(2);
    expect(listings.map((l) => l.distributorId).sort()).toEqual([
      "hit-a",
      "hit-b",
    ]);
    expect(listings[0].priceHistory).toHaveLength(1);
    expect(listings[0].priceHistory[0].price).toBeGreaterThan(0);
    expect(listings[0].lastChecked).toBe(new Date(NOW).toISOString());
  });

  it("reports progress with done/total", async () => {
    const onProgress = vi.fn();
    const fetchPrice = vi.fn(async () => null);
    await discoverListings("MODEL", {
      parserIds: ["a", "b", "c"],
      fetchPrice,
      now: NOW,
      onProgress,
    });
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  it("swallows fetch errors per distributor", async () => {
    const fetchPrice = vi.fn(async (d: string) => {
      if (d === "boom") throw new Error("network");
      return snapshotResult();
    });
    const listings = await discoverListings("MODEL", {
      parserIds: ["boom", "ok"],
      fetchPrice,
      now: NOW,
    });
    expect(listings.map((l) => l.distributorId)).toEqual(["ok"]);
  });
});
```

Note: check `ServerPriceResult`/snapshot field names in `lib/types.ts` and adjust the fixture; check whether `expectedDate` is optional on the snapshot and include it in the listing mapping accordingly.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/listing-discovery.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/listing-discovery.ts`**

```typescript
import { fetchServerPrice } from "./server-prices";
import { getAllParserIds } from "./scrapers/registry";
import type { DistributorListing } from "./types";

const CONCURRENCY = 3;

export function customProductSlug(modelNumber: string): string {
  const slug = modelNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `custom-${slug || "product"}`;
}

type FetchPrice = typeof fetchServerPrice;

export interface DiscoverOptions {
  parserIds?: string[];
  fetchPrice?: FetchPrice;
  now?: number;
  onProgress?: (done: number, total: number) => void;
}

// Searches every distributor for a model number and returns one listing per
// hit. Misses/errors are skipped — discovery is best-effort.
export async function discoverListings(
  modelNumber: string,
  opts: DiscoverOptions = {},
): Promise<DistributorListing[]> {
  const {
    parserIds = getAllParserIds(),
    fetchPrice = fetchServerPrice,
    now = Date.now(),
    onProgress,
  } = opts;

  const found: DistributorListing[] = [];
  let done = 0;
  const total = parserIds.length;

  for (let i = 0; i < parserIds.length; i += CONCURRENCY) {
    const batch = parserIds.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (distributorId) => {
        try {
          const result = await fetchPrice(distributorId, modelNumber);
          if (result?.snapshot) {
            const iso = new Date(now).toISOString();
            found.push({
              distributorId,
              price: result.snapshot.price,
              currency: result.snapshot.currency,
              stockStatus: result.snapshot.stockStatus,
              expectedDate: result.snapshot.expectedDate,
              url: result.snapshot.url,
              lastChecked: iso,
              priceHistory: [
                {
                  date: iso,
                  price: result.snapshot.price,
                  currency: result.snapshot.currency,
                  stockStatus: result.snapshot.stockStatus,
                },
              ],
            });
          }
        } catch {
          // Best-effort: skip failing distributors.
        } finally {
          done += 1;
          onProgress?.(done, total);
        }
      }),
    );
  }

  return found;
}
```

- [ ] **Step 4: Create `lib/server-product-parse.ts`**

```typescript
import { createTRPCClient } from "./trpc";

const TIMEOUT_MS = 8000;

export interface ParsedProduct {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

export async function fetchParsedProduct(
  raw: string,
): Promise<ParsedProduct | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.products.parse.query({ raw: raw.slice(0, 2000) }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.product ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/listing-discovery.test.ts` — PASS.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/listing-discovery.ts lib/server-product-parse.ts tests/listing-discovery.test.ts && git commit -m "feat: add listing discovery and product-parse client wrapper"
```

---

## Task 3: ManualAddSheet + search wiring + push

**Files:**
- Create: `components/search/manual-add-sheet.tsx`
- Modify: `app/search.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Create `components/search/manual-add-sheet.tsx`**

Follow the bottom-sheet conventions of `components/search/bulk-import-modal.tsx` (Modal, transparent backdrop, rounded sheet, close X):

```typescript
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAlert } from "@/lib/alert";
import { addToWatchlist, updateProductListings } from "@/lib/storage";
import { fetchParsedProduct } from "@/lib/server-product-parse";
import {
  customProductSlug,
  discoverListings,
} from "@/lib/listing-discovery";

interface Draft {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  modelNumber: "",
  brand: "",
  category: "",
  description: "",
};

function fieldStyle(colors: ReturnType<typeof useColors>) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
    marginBottom: 12,
  };
}

export function ManualAddSheet({
  visible,
  onClose,
  initialText,
  trackedIds,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  initialText?: string;
  trackedIds: Set<string>;
  onAdded?: () => void;
}) {
  const colors = useColors();
  const [raw, setRaw] = useState(initialText ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [aiFailed, setAiFailed] = useState(false);

  const reset = () => {
    setRaw(initialText ?? "");
    setDraft(null);
    setParsing(false);
    setAdding(false);
    setProgress(null);
    setAiFailed(false);
  };

  const handleClose = () => {
    if (parsing || adding) return;
    reset();
    onClose();
  };

  const handleParse = async () => {
    const text = raw.trim();
    if (!text || parsing) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setParsing(true);
    try {
      const parsed = await fetchParsedProduct(text);
      if (parsed) {
        setDraft(parsed);
        setAiFailed(false);
      } else {
        setDraft({ ...EMPTY_DRAFT, name: text.slice(0, 200) });
        setAiFailed(true);
      }
    } finally {
      setParsing(false);
    }
  };

  const handleAdd = async () => {
    if (!draft || adding) return;
    const name = draft.name.trim();
    const modelNumber = draft.modelNumber.trim();
    if (!name || !modelNumber) return;

    const id = customProductSlug(modelNumber);
    if (trackedIds.has(id)) {
      showAlert("Already Tracked", "That model number is already in your watchlist.");
      return;
    }

    setAdding(true);
    try {
      await addToWatchlist({
        id,
        name,
        modelNumber,
        brand: draft.brand.trim(),
        category: draft.category.trim() || "Other",
        description: draft.description.trim(),
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: [],
      });
      setProgress("Searching distributors 0/…");
      const listings = await discoverListings(modelNumber, {
        onProgress: (done, total) =>
          setProgress(`Searching distributors ${done}/${total}…`),
      });
      await updateProductListings(id, listings);
      showAlert(
        "Product Added",
        listings.length > 0
          ? `Added "${name}" — found prices at ${listings.length} distributor${listings.length === 1 ? "" : "s"}.`
          : `Added "${name}". No distributor had it yet — we'll keep watching.`,
      );
      reset();
      onAdded?.();
      onClose();
    } finally {
      setAdding(false);
      setProgress(null);
    }
  };

  const canAdd =
    !!draft && draft.name.trim().length > 0 && draft.modelNumber.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "85%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", flex: 1 }}>
              Add Custom Product ✨
            </Text>
            <TouchableOpacity onPress={handleClose} style={{ padding: 4 }}>
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {draft === null ? (
            <>
              <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
                Paste anything — a model number, product name, or a spec-sheet
                paragraph. AI cleans it up.
              </Text>
              <TextInput
                value={raw}
                onChangeText={setRaw}
                multiline
                autoFocus
                placeholder={"e.g. MikroTik CRS326-24S+2Q+RM switch, 24x SFP+ 2x QSFP+, desktop rackmount"}
                placeholderTextColor={colors.muted}
                style={{ ...fieldStyle(colors), minHeight: 110, textAlignVertical: "top" }}
              />
              <TouchableOpacity
                onPress={handleParse}
                disabled={parsing || raw.trim().length === 0}
                style={{
                  backgroundColor: raw.trim().length > 0 && !parsing ? colors.primary : colors.border,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {parsing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="wand.and.stars" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                      Clean up with AI
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView>
              {aiFailed && (
                <Text style={{ color: colors.warning, fontSize: 12, marginBottom: 10 }}>
                  Couldn't reach the AI — please fill in the details manually.
                </Text>
              )}
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
                Review and edit before adding.
              </Text>
              <TextInput
                value={draft.name}
                onChangeText={(v) => setDraft({ ...draft, name: v })}
                placeholder="Product name"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.modelNumber}
                onChangeText={(v) => setDraft({ ...draft, modelNumber: v })}
                placeholder="Model number"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.brand}
                onChangeText={(v) => setDraft({ ...draft, brand: v })}
                placeholder="Brand"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.category}
                onChangeText={(v) => setDraft({ ...draft, category: v })}
                placeholder="Category"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.description}
                onChangeText={(v) => setDraft({ ...draft, description: v })}
                placeholder="Description"
                placeholderTextColor={colors.muted}
                multiline
                style={{ ...fieldStyle(colors), minHeight: 70, textAlignVertical: "top" }}
              />
              {progress && (
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
                  {progress}
                </Text>
              )}
              <TouchableOpacity
                onPress={handleAdd}
                disabled={!canAdd || adding}
                style={{
                  backgroundColor: canAdd && !adding ? colors.primary : colors.border,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="plus.circle.fill" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                      Add &amp; Search Distributors
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDraft(null)}
                disabled={parsing || adding}
                style={{ alignItems: "center", paddingVertical: 6 }}
              >
                <Text style={{ color: colors.muted, fontSize: 13 }}>Back to paste</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
```

ICON CHECK: verify `wand.and.stars` has an Android/web mapping in `components/ui/icon-symbol.tsx`; add one (e.g. `"wand.and.stars": "auto-fix-high"`) or reuse a mapped icon.

- [ ] **Step 2: Wire into `app/search.tsx`**

1. Add state: `const [manualVisible, setManualVisible] = useState(false);`
2. In the header row, next to the existing bulk-import button, add:

```tsx
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setManualVisible(true);
          }}
          style={{ padding: 4 }}
        >
          <IconSymbol name="wand.and.stars" size={22} color={colors.primary} />
        </TouchableOpacity>
```

3. Below `<BulkImportModal …>` add:

```tsx
      <ManualAddSheet
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        initialText={query}
        trackedIds={trackedIds}
        onAdded={loadData}
      />
```

with import `import { ManualAddSheet } from "@/components/search/manual-add-sheet";`.

- [ ] **Step 3: Verify**

1. Run `pnpm check` — 0 errors
2. Run `pnpm lint` — no new errors
3. Run `pnpm test` — all pass

- [ ] **Step 4: Update `todo.md`**

Append Phase 85 section:

```markdown
## Phase 85: Manual Add with LLM-Assisted Cleanup (v5.33)

- [x] Add server-side product text parsing via LLM (products.parse endpoint)
- [x] Add listing discovery across all distributors (fetchServerPrice reuse)
- [x] Add custom product slug + tRPC parse wrapper with timeout
- [x] Build two-step ManualAddSheet (paste → AI cleanup → review → add + discover)
- [x] Wire manual-add button into Search screen header
```

- [ ] **Step 5: Commit and push**

```bash
git add components/search/manual-add-sheet.tsx app/search.tsx todo.md && git commit -m "feat: add manual product entry with AI-assisted cleanup"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New server module | `server/product-parse.ts` (~90 lines) |
| New client modules | `lib/listing-discovery.ts`, `lib/server-product-parse.ts` |
| New tests | ~9 cases across 2 files |
| New UI | `manual-add-sheet.tsx` (~280 lines) |
| Modified | `server/routers.ts`, `app/search.tsx` |
