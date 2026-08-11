# Stock-Like Price Chart with Tap-to-Inspect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the mobile Product Detail price history chart with tap-to-inspect (crosshair + tooltip showing exact price/date), and add a price history chart with hover/tap inspection to the desktop Product Detail screen.

**Architecture:** The mobile `PriceHistoryChart` (in `app/product/[id].tsx`) gets a tap handler that computes the nearest data point and renders a crosshair + tooltip. The desktop Product Detail gets a new "Price History" section using Recharts (already a dependency) with its built-in `Tooltip`.

**Tech Stack:** TypeScript, react-native-svg (mobile), Recharts (desktop), Expo Router (mobile), React Router (desktop).

---

## File Structure

### New Files
- `tests/price-chart.test.ts` — unit tests for nearest-point logic
- `desktop/tests/price-chart.test.tsx` — component tests for the desktop chart

### Modified Files
- `app/product/[id].tsx` — enhance `PriceHistoryChart` with tap-to-inspect tooltip
- `desktop/src/pages/ProductDetail.tsx` — add Price History section with Recharts chart

---

## Task 1: Create Nearest-Point Utility

**Files:**
- Create: `lib/price-chart.ts`
- Test: `tests/price-chart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/price-chart.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { findNearestIndex } from "@/lib/price-chart";

describe("findNearestIndex", () => {
  it("returns the index of the nearest x position", () => {
    // 3 points at x = 0, 50, 100
    expect(findNearestIndex(0, 3)).toBe(0);
    expect(findNearestIndex(25, 3)).toBe(0);
    expect(findNearestIndex(26, 3)).toBe(1);
    expect(findNearestIndex(75, 3)).toBe(1);
    expect(findNearestIndex(76, 3)).toBe(2);
    expect(findNearestIndex(100, 3)).toBe(2);
  });

  it("clamps to valid range", () => {
    expect(findNearestIndex(-10, 3)).toBe(0);
    expect(findNearestIndex(200, 3)).toBe(2);
  });

  it("handles single point", () => {
    expect(findNearestIndex(50, 1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/price-chart.test.ts`
Expected: FAIL with "Cannot find module '@/lib/price-chart'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/price-chart.ts`:

```typescript
export function findNearestIndex(x: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.max(0, Math.min(x, 100));
  const index = Math.round((clamped / 100) * (count - 1));
  return Math.max(0, Math.min(index, count - 1));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/price-chart.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/price-chart.ts tests/price-chart.test.ts
git commit -m "feat: add nearest-point utility for chart tap-to-inspect"
```

---

## Task 2: Add Tap-to-Inspect to Mobile Chart

**Files:**
- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Add imports**

Add `Pressable` to the react-native import, and import `findNearestIndex`:

```typescript
import { findNearestIndex } from "@/lib/price-chart";
```

Add `Pressable` to the react-native import list (around line 1-20).

- [ ] **Step 2: Add selectedIndex state to PriceHistoryChart**

In the `PriceHistoryChart` function (around line 2022), add state:

```typescript
const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
```

Note: `useState` is already imported.

- [ ] **Step 3: Add tap handler and crosshair/tooltip rendering**

In the `PriceHistoryChart` return, wrap the `<Svg>` in a `Pressable` and add a crosshair + tooltip when `selectedIndex` is set. Replace the `return (` block with:

```tsx
  return (
    <Pressable
      onPress={(e) => {
        const x = e.nativeEvent.locationX;
        const idx = findNearestIndex(
          ((x - padL) / (width - padL - 16)) * 100,
          coords.length,
        );
        setSelectedIndex(idx);
      }}
    >
      <Svg width={width} height={height}>
        {[maxY, midY, minY].map((y, i) => (
          <Line
            key={i}
            x1={padL}
            y1={y}
            x2={width - 16}
            y2={y}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}
        <SvgText
          x={padL - 6}
          y={maxY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {maxP.toFixed(0)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={midY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {midP.toFixed(0)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={minY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {minP.toFixed(0)}
        </SvgText>
        <Polyline
          points={polylineStr}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={3} fill={lineColor} />
        ))}
        {[0, Math.floor((coords.length - 1) / 2), coords.length - 1].map(
          (idx) => {
            const c = coords[idx];
            const label = new Date(c.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
            return (
              <SvgText
                key={idx}
                x={c.x}
                y={height - padB + 16}
                fontSize={10}
                fill={colors.muted}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          },
        )}
        {(() => {
          const minCoord = coords.reduce((a, b) => (b.price < a.price ? b : a));
          const maxCoord = coords.reduce((a, b) => (b.price > a.price ? b : a));
          return (
            <>
              <Rect
                x={minCoord.x - 22}
                y={minCoord.y - 16}
                width={44}
                height={14}
                rx={4}
                fill={colors.error + "33"}
              />
              <SvgText
                x={minCoord.x}
                y={minCoord.y - 5}
                fontSize={9}
                fill={colors.error}
                textAnchor="middle"
                fontWeight="700"
              >
                LOW {minP.toFixed(0)}
              </SvgText>
              <Rect
                x={maxCoord.x - 24}
                y={maxCoord.y + 4}
                width={48}
                height={14}
                rx={4}
                fill={colors.success + "33"}
              />
              <SvgText
                x={maxCoord.x}
                y={maxCoord.y + 14}
                fontSize={9}
                fill={colors.success}
                textAnchor="middle"
                fontWeight="700"
              >
                HIGH {maxP.toFixed(0)}
              </SvgText>
            </>
          );
        })()}
        {selectedIndex != null && coords[selectedIndex] && (
          <>
            <Line
              x1={coords[selectedIndex].x}
              y1={padT}
              x2={coords[selectedIndex].x}
              y2={padT + usableH}
              stroke={colors.muted}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <Rect
              x={Math.min(coords[selectedIndex].x - 40, width - 90)}
              y={padT - 2}
              width={80}
              height={22}
              rx={6}
              fill={colors.surface}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={Math.min(coords[selectedIndex].x, width - 50)}
              y={padT + 8}
              fontSize={10}
              fill={colors.foreground}
              textAnchor="middle"
              fontWeight="700"
            >
              {formatPrice(coords[selectedIndex].price, currency)}
            </SvgText>
            <SvgText
              x={Math.min(coords[selectedIndex].x, width - 50)}
              y={padT + 18}
              fontSize={8}
              fill={colors.muted}
              textAnchor="middle"
            >
              {new Date(coords[selectedIndex].date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </SvgText>
          </>
        )}
      </Svg>
    </Pressable>
  );
```

Note: `formatPrice` is already imported. `padL`, `padT`, `padB`, `usableH`, `coords`, `minP`, `maxP`, `midP`, `maxY`, `midY`, `minY`, `polylineStr`, `lineColor` are all already computed in the `points` memo and destructured.

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add app/product/[id].tsx
git commit -m "feat: add tap-to-inspect tooltip to mobile price history chart"
```

---

## Task 3: Add Price History Chart to Desktop Product Detail

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add Recharts imports**

Add to the imports in `desktop/src/pages/ProductDetail.tsx`:

```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
```

- [ ] **Step 2: Add a Price History section**

Find the "All Listings" section (around line 292). Add a "Price History" section above it that renders a Recharts chart for the best listing's price history:

```tsx
{/* Price History Section */}
{bestListing && bestListing.priceHistory && bestListing.priceHistory.length >= 2 && (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
    <h2 className="text-lg font-semibold mb-3">Price History</h2>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={bestListing.priceHistory.map((p) => ({
          date: new Date(p.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          price: p.price,
        }))}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#0F52BA"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
```

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "feat: add price history chart to desktop product detail"
```

---

## Task 4: Add Desktop Chart Component Test

**Files:**
- Create: `desktop/tests/price-chart.test.tsx`

- [ ] **Step 1: Create the test**

Create `desktop/tests/price-chart.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

describe("Price History Chart", () => {
  it("renders a Recharts line chart with price data", () => {
    const data = [
      { date: "Jan 1", price: 100 },
      { date: "Jan 2", price: 95 },
      { date: "Jan 3", price: 110 },
    ];
    render(
      <ResponsiveContainer width={400} height={300}>
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="price" />
        </LineChart>
      </ResponsiveContainer>,
    );
    expect(screen.getByText("Jan 1")).toBeDefined();
    expect(screen.getByText("Jan 2")).toBeDefined();
    expect(screen.getByText("Jan 3")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter desktop test tests/price-chart.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add desktop/tests/price-chart.test.tsx
git commit -m "test: add desktop price history chart component test"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run all checks**

```bash
pnpm check
pnpm lint
pnpm test
pnpm --filter desktop check
pnpm --filter desktop test
```

Expected: All pass

- [ ] **Step 2: Update todo.md**

Add Phase 23 entry for the stock-like price chart.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 23 stock-like price chart to todo.md"
```
