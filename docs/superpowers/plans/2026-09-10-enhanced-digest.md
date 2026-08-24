# Enhanced Weekly Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the digest (value delta, new/removed products, biggest-mover sorting), add a full in-app digest card on Stats, and make the push lead with the most important changes.

**Architecture:** Extend `computeDigest`/`formatDigestNotification` in `lib/price-digest.ts` (existing tests guard behavior); new `DigestCard` on the Stats screen computes the current-period digest live from the stored snapshot.

**Tech Stack:** TypeScript strict, vitest, React Native.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/price-digest.ts` | extended DigestResult + formatter |
| `tests/price-digest.test.ts` | new cases |
| `components/stats/digest-card.tsx` | full in-app digest |
| `app/stats.tsx` | snapshot load + card render |

---

## Task 1: Extended computation + tests + digest card + wiring

**Files:**
- Modify: `lib/price-digest.ts`
- Test: `tests/price-digest.test.ts`
- Create: `components/stats/digest-card.tsx`
- Modify: `app/stats.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Extend `tests/price-digest.test.ts`**

Add to existing describes (fixtures already exist in the file — reuse their helper style):

```typescript
  it("computes valueDelta and sorts price changes biggest-first", () => {
    const previous = makeSnapshot([
      { id: "p1", name: "A", bestPrice: 100, stockStatus: "in_stock" },
      { id: "p2", name: "B", bestPrice: 50, stockStatus: "in_stock" },
    ]);
    const watchlist = [
      makeProduct("p1", "A", 120),
      makeProduct("p2", "B", 40),
    ];
    const result = computeDigest(previous, watchlist, SETTINGS, []);
    expect(result.valueDelta).toEqual({
      from: 150,
      to: 160,
      percent: expect.closeTo(6.67, 1),
    });
    // |+20%| ranks above |-20%|? equal — stable order; use distinct magnitudes:
  });

  it("sorts price changes by absolute percent descending", () => {
    const previous = makeSnapshot([
      { id: "p1", name: "Small", bestPrice: 100, stockStatus: "in_stock" },
      { id: "p2", name: "Big", bestPrice: 100, stockStatus: "in_stock" },
    ]);
    const watchlist = [
      makeProduct("p1", "Small", 105),
      makeProduct("p2", "Big", 130),
    ];
    const result = computeDigest(previous, watchlist, SETTINGS, []);
    expect(result.priceChanges[0].name).toBe("Big");
    expect(result.priceChanges[1].name).toBe("Small");
  });

  it("detects added and removed products", () => {
    const previous = makeSnapshot([
      { id: "keep", name: "Keep", bestPrice: 10, stockStatus: "in_stock" },
      { id: "gone", name: "Gone", bestPrice: 20, stockStatus: "in_stock" },
    ]);
    const watchlist = [
      makeProduct("keep", "Keep", 10),
      makeProduct("new1", "New", 30),
    ];
    const result = computeDigest(previous, watchlist, SETTINGS, []);
    expect(result.newProducts.map((p) => p.productId)).toEqual(["new1"]);
    expect(result.removedProducts.map((p) => p.productId)).toEqual(["gone"]);
  });

  it("leads the notification with value delta and biggest mover", () => {
    const previous = makeSnapshot([
      { id: "p1", name: "Mover", bestPrice: 100, stockStatus: "in_stock" },
    ]);
    const watchlist = [makeProduct("p1", "Mover", 80)];
    const { title, body } = formatDigestNotification(
      computeDigest(previous, watchlist, SETTINGS, []),
    );
    expect(title).toContain("📊");
    expect(body.split("\n")[0]).toMatch(/Watchlist value \$100 → \$80/);
    expect(body).toContain("Mover: -20%");
  });
```

Adapt to the file's actual fixture helpers (`makeSnapshot`/`makeProduct`/`SETTINGS`) — read the top of the test file first and reuse its builders; if they don't exist as helpers, follow each test's inline construction pattern.

- [ ] **Step 2: Run tests to verify new cases fail**

Run: `pnpm vitest run tests/price-digest.test.ts` — FAIL on new cases (valueDelta undefined etc.).

- [ ] **Step 3: Extend `lib/price-digest.ts`**

1. `DigestResult` additions:

```typescript
  valueDelta: { from: number; to: number; percent: number } | null;
  newProducts: { productId: string; name: string }[];
  removedProducts: { productId: string; name: string }[];
```

2. In `computeDigest`, after building `current`/`prevMap`:

```typescript
  const prevIds = new Set((previous?.products ?? []).map((p) => p.productId));
  const currentIds = new Set(current.map((p) => p.productId));

  const newProducts = current
    .filter((p) => !prevIds.has(p.productId))
    .map((p) => ({ productId: p.productId, name: p.name }));
  const removedProducts = (previous?.products ?? [])
    .filter((p) => !currentIds.has(p.productId))
    .map((p) => ({ productId: p.productId, name: p.name }));
```

3. After `buildSummary(current)` compute valueDelta from summaries of previous vs current. Build prevSummary the same way from `previous.products ?? []`:

```typescript
  const prevSummary = buildSummary(previous?.products ?? []);
  const summary = buildSummary(current);
  const valueDelta =
    previous && prevSummary.totalValue > 0 && summary.totalValue > 0
      ? {
          from: prevSummary.totalValue,
          to: summary.totalValue,
          percent:
            ((summary.totalValue - prevSummary.totalValue) /
              prevSummary.totalValue) *
            100,
        }
      : null;
```

4. Sort changes before returning:

```typescript
  priceChanges.sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent));
```

5. Return the three new fields.

6. Rewrite `formatDigestNotification`:

```typescript
export function formatDigestNotification(result: DigestResult): {
  title: string;
  body: string;
} {
  const { summary, valueDelta } = result;
  const lines: string[] = [];

  if (valueDelta) {
    const sign = valueDelta.percent >= 0 ? "+" : "";
    lines.push(
      `Watchlist value ${formatPrice(valueDelta.from, "USD")} → ${formatPrice(valueDelta.to, "USD")} (${sign}${valueDelta.percent.toFixed(1)}%)`,
    );
  } else {
    lines.push(
      `Watchlist: ${formatPrice(summary.totalValue, "USD")} · ${summary.inStock} in stock`,
    );
  }
  lines.push(
    `${summary.inStock} in stock · ${summary.backOrder} back-order · ${summary.outOfStock} out of stock`,
  );

  for (const c of result.priceChanges.slice(0, 3)) {
    const sign = c.percent > 0 ? "+" : "";
    lines.push(
      `${c.name}: ${sign}${c.percent.toFixed(0)}% (${formatPrice(c.from, "USD")} → ${formatPrice(c.to, "USD")})`,
    );
  }
  for (const s of result.stockChanges.slice(0, 2)) {
    lines.push(`${s.name}: ${s.from} → ${s.to}`);
  }
  for (const t of result.alertTargetsHit.slice(0, 2)) {
    lines.push(`🎯 ${t.name}: target hit at ${formatPrice(t.price, t.currency)}`);
  }
  if (result.newProducts.length > 0)
    lines.push(`➕ ${result.newProducts.length} product(s) added`);
  if (result.removedProducts.length > 0)
    lines.push(`➖ ${result.removedProducts.length} product(s) removed`);

  if (
    result.priceChanges.length === 0 &&
    result.stockChanges.length === 0 &&
    result.alertTargetsHit.length === 0 &&
    result.newProducts.length === 0 &&
    result.removedProducts.length === 0
  ) {
    lines.push("No changes since your last digest.");
  }

  return {
    title: "📊 Price Digest",
    body: lines.slice(0, 9).join("\n"),
  };
}
```

Note: existing notification tests may assert the old single-line header — update those assertions to the new two-line header intentionally (they encode old behavior).

- [ ] **Step 7: Create `components/stats/digest-card.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type { DigestResult } from "@/lib/price-digest";

export function DigestCard({
  result,
  periodLabel,
}: {
  result: DigestResult;
  periodLabel: string;
}) {
  const colors = useColors();
  const empty =
    result.priceChanges.length === 0 &&
    result.stockChanges.length === 0 &&
    result.alertTargetsHit.length === 0 &&
    result.newProducts.length === 0 &&
    result.removedProducts.length === 0;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        Digest — {periodLabel}
      </Text>

      {result.valueDelta && (
        <View style={{ flexDirection: "row", marginTop: 6, alignItems: "baseline" }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginRight: 8 }}>
            {formatPrice(result.valueDelta.from, "USD")} →{" "}
            {formatPrice(result.valueDelta.to, "USD")}
          </Text>
          <Text
            style={{
              color: result.valueDelta.percent >= 0 ? colors.error : colors.success,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {result.valueDelta.percent >= 0 ? "+" : ""}
            {result.valueDelta.percent.toFixed(1)}%
          </Text>
        </View>
      )}

      {empty ? (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
          No changes in this period.
        </Text>
      ) : (
        <>
          {result.priceChanges.length > 0 && (
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginTop: 10 }}>
              Price Changes
            </Text>
          )}
          {result.priceChanges.map((c) => (
            <View key={c.productId} style={{ flexDirection: "row", paddingVertical: 4, gap: 8 }}>
              <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatPrice(c.from, "USD")} → {formatPrice(c.to, "USD")}
              </Text>
              <Text
                style={{
                  color: c.percent > 0 ? colors.error : colors.success,
                  fontSize: 12,
                  fontWeight: "600",
                  minWidth: 44,
                  textAlign: "right",
                }}
              >
                {c.percent > 0 ? "+" : ""}
                {c.percent.toFixed(0)}%
              </Text>
            </View>
          ))}

          {result.stockChanges.length > 0 && (
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginTop: 10 }}>
              Stock Changes
            </Text>
          )}
          {result.stockChanges.map((s) => (
            <Text key={s.productId} style={{ color: colors.muted, fontSize: 12, paddingVertical: 3 }}>
              {s.name}: {s.from} → {s.to}
            </Text>
          ))}

          {result.alertTargetsHit.length > 0 && (
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginTop: 10 }}>
              🎯 Targets Hit
            </Text>
          )}
          {result.alertTargetsHit.map((t) => (
            <Text key={t.productId} style={{ color: colors.muted, fontSize: 12, paddingVertical: 3 }}>
              {t.name} at {formatPrice(t.price, t.currency)}
            </Text>
          ))}

          {(result.newProducts.length > 0 || result.removedProducts.length > 0) && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
              {result.newProducts.length > 0 ? `➕ ${result.newProducts.length} added · ` : ""}
              {result.removedProducts.length > 0 ? `➖ ${result.removedProducts.length} removed` : ""}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 8: Wire into `app/stats.tsx`**

1. Imports: `getPriceDigestSnapshot`, `computeDigest`, `type DigestResult`, `DigestCard`.
2. State + load inside the existing mount effect (extend the Promise.all or add a chained load):

```typescript
  const [digestSnapshot, setDigestSnapshot] = useState<DigestSnapshot | null>(null);
```

load: `void getPriceDigestSnapshot().then(setDigestSnapshot);` alongside settings/watchlist loads.

3. Memo:

```typescript
  const digest = useMemo(() => {
    if (!digestSnapshot || settings?.digestFrequency === "off") return null;
    return computeDigest(digestSnapshot, watchlist, settings, []);
  }, [digestSnapshot, watchlist, settings]);
```

(Stats screen keeps `settings` state — check what it stores; adapt variable name. alerts arg: pass loaded alerts if available cheaply, else `[]` — targets-hit section then simply won't render.)

4. Render above `<MoversCard>` when digest != null:

```tsx
          <DigestCard
            result={digest}
            periodLabel={
              settings?.digestFrequency === "weekly" ? "this week" : "today"
            }
          />
```

- [ ] **Step 9: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 10: Update `todo.md` + commit + push**

Append Phase 94 section:

```markdown
## Phase 94: Enhanced Weekly Digest (v5.42)

- [x] Extend digest computation (value delta, new/removed products, mover sorting)
- [x] Smarter push notification (value delta lead, ~9 lines)
- [x] Add full in-app digest card on Stats screen
```

Then:

```bash
git add lib/price-digest.ts tests/price-digest.test.ts components/stats/digest-card.tsx app/stats.tsx todo.md && git commit -m "feat: enhance weekly digest with in-app view"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| Extended module | `lib/price-digest.ts` (+valueDelta/new/removed/sorting) |
| New tests | ~4 cases |
| New component | `digest-card.tsx` (~130 lines) |
| Modified | stats screen |
