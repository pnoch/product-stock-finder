# Chart Scrubbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag/tap scrubbing to both price charts — continuous tooltip tracking on the product chart and a multi-distributor crosshair tooltip on the compare chart.

**Architecture:** Two pure helpers in `lib/price-chart.ts` (TDD, extending the existing test file); the product chart swaps `Pressable` for RN responders (drag moves selection); the compare multi-line chart gains a crosshair with per-series nearest-point tooltip.

**Tech Stack:** React Native responder system, react-native-svg, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/price-chart.ts` | +`indexForLocationX`, +`nearestByX` |
| `tests/price-chart.test.ts` | extend with helper tests |
| `components/price-history-chart.tsx` | drag scrubbing |
| `components/compare/multi-line-chart.tsx` | crosshair + tooltip |

---

## Task 1: Helpers (TDD)

**Files:**
- Modify: `lib/price-chart.ts`
- Test: `tests/price-chart.test.ts`

- [ ] **Step 1: Extend `tests/price-chart.test.ts`**

Add to the existing file (keep current tests):

```typescript
describe("indexForLocationX", () => {
  it("maps location to nearest index within padding", () => {
    // width=200, padL=50, padR=50 → usable [50,150], 3 points at 50/100/150
    expect(indexForLocationX(50, 200, 50, 50, 3)).toBe(0);
    expect(indexForLocationX(99, 200, 50, 50, 3)).toBe(0);
    expect(indexForLocationX(101, 200, 50, 50, 3)).toBe(1);
    expect(indexForLocationX(149, 200, 50, 50, 3)).toBe(2);
  });

  it("clamps touches outside the plot area", () => {
    expect(indexForLocationX(0, 200, 50, 50, 3)).toBe(0);
    expect(indexForLocationX(200, 200, 50, 50, 3)).toBe(2);
  });
});

describe("nearestByX", () => {
  it("finds exact and nearest matches", () => {
    const coords = [
      { x: 10, v: "a" },
      { x: 50, v: "b" },
      { x: 90, v: "c" },
    ];
    expect(nearestByX(coords, 50)?.v).toBe("b");
    expect(nearestByX(coords, 48)?.v).toBe("b");
    expect(nearestByX(coords, 89)?.v).toBe("c");
  });

  it("returns null for empty coords", () => {
    expect(nearestByX([], 10)).toBeNull();
  });
});
```

with imports updated:

```typescript
import {
  findNearestIndex,
  indexForLocationX,
  nearestByX,
} from "@/lib/price-chart";
```

- [ ] **Step 2: Run test to verify new cases fail**

Run: `pnpm vitest run tests/price-chart.test.ts`
Expected: FAIL on the two new describes (functions not defined).

- [ ] **Step 3: Implement in `lib/price-chart.ts`**

```typescript
export function indexForLocationX(
  locationX: number,
  width: number,
  padL: number,
  padR: number,
  count: number,
): number {
  const usable = width - padL - padR;
  if (usable <= 0) return 0;
  const percent = ((locationX - padL) / usable) * 100;
  return findNearestIndex(percent, count);
}

export function nearestByX<T extends { x: number }>(
  coords: T[],
  targetX: number,
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of coords) {
    const dist = Math.abs(c.x - targetX);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/price-chart.test.ts` — PASS.
Run: `pnpm check` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/price-chart.ts tests/price-chart.test.ts && git commit -m "feat: add chart scrubbing helpers"
```

---

## Task 2: Product chart drag scrubbing

**Files:**
- Modify: `components/price-history-chart.tsx`

- [ ] **Step 1: Replace Pressable with responder View**

1. Replace the `Pressable` import with `View` (already imported? check — add `View` to the react-native import; drop `Pressable` if unused).
2. Replace the `<Pressable onPress={...}>…</Pressable>` wrapper with:

```tsx
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        const idx = indexForLocationX(
          e.nativeEvent.locationX,
          width,
          padL,
          padR,
          coords.length,
        );
        setSelectedIndex((prev) => (prev === idx ? null : idx));
      }}
      onResponderMove={(e) => {
        setSelectedIndex(
          indexForLocationX(
            e.nativeEvent.locationX,
            width,
            padL,
            padR,
            coords.length,
          ),
        );
      }}
    >
```

(closing `</View>` instead of `</Pressable>`).

3. Add import: `import { findNearestIndex, indexForLocationX } from "@/lib/price-chart";` — then remove `findNearestIndex` if now unused (the old inline percent math is gone).

- [ ] **Step 2: Verify + commit**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass. Run: `pnpm lint` — no new errors.

```bash
git add components/price-history-chart.tsx && git commit -m "feat: drag scrubbing on price history chart"
```

---

## Task 3: Compare chart crosshair + push

**Files:**
- Modify: `components/compare/multi-line-chart.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Add crosshair scrubbing**

In `components/compare/multi-line-chart.tsx`:

1. Add imports:

```typescript
import { Fragment, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { formatPrice } from "@/lib/currency";
import {
  findNearestIndex as _unusedFind, // REMOVE this line if linter complains — only import what's used:
} from "@/lib/price-chart";
```

Final imports should be exactly:

```typescript
import { Fragment, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText, Rect } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";
import { PricePoint } from "@/lib/types";
import { convertPrice, formatPrice } from "@/lib/currency";
import { nearestByX } from "@/lib/price-chart";
```

(`Rect` added to the svg import.)

2. Add state inside the component (after colors):

```typescript
  const [scrubX, setScrubX] = useState<number | null>(null);
  const movedRef = useRef(false);
  const padLConst = 56;
  const padRConst = 16;

  const clampScrub = (x: number) =>
    Math.max(padLConst, Math.min(x, width - padRConst));
```

3. Wrap the existing `<Svg …>…</Svg>` in a responder View:

```tsx
  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        movedRef.current = false;
        setScrubX(clampScrub(e.nativeEvent.locationX));
      }}
      onResponderMove={(e) => {
        movedRef.current = true;
        setScrubX(clampScrub(e.nativeEvent.locationX));
      }}
      onResponderRelease={() => {
        if (!movedRef.current) setScrubX(null);
      }}
    >
      <Svg width={width} height={height}>
        {/* existing content unchanged */}
      </Svg>
    </View>
  );
```

4. Inside the `<Svg>`, after the existing date-labels block, render the crosshair when active:

```tsx
      {(() => {
        if (scrubX == null || allCoords.length === 0) return null;
        const firstSeries = allCoords[0].coords;
        const nearestFirst = nearestByX(firstSeries, scrubX);
        if (!nearestFirst) return null;
        const rows = allCoords.slice(0, 6).map((s) => ({
          label: s.label,
          color: s.color,
          point: nearestByX(s.coords, scrubX),
        }));
        const extra = allCoords.length - rows.length;
        return (
          <>
            <Line
              x1={scrubX}
              y1={padT}
              x2={scrubX}
              y2={padT + usableH}
              stroke={colors.muted}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {rows.map(
              (row) =>
                row.point && (
                  <Circle
                    key={`scrub-${row.label}`}
                    cx={row.point.x}
                    cy={row.point.y}
                    r={5}
                    fill={row.color}
                  />
                ),
            )}
            <Rect
              x={padLConst}
              y={padT - 2}
              width={Math.min(190, width / 2)}
              height={18 + rows.filter((r) => r.point).length * 13}
              rx={6}
              fill={colors.surface}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={padLConst + 8}
              y={padT + 12}
              fontSize={9}
              fill={colors.muted}
              fontWeight="700"
            >
              {new Date(nearestFirst.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </SvgText>
            {rows.map((row, i) =>
              row.point ? (
                <Fragment key={`row-${row.label}`}>
                  <Circle cx={padLConst + 12} cy={padT + 24 + i * 13} r={3} fill={row.color} />
                  <SvgText
                    x={padLConst + 20}
                    y={padT + 27 + i * 13}
                    fontSize={9}
                    fill={colors.foreground}
                  >
                    {`${row.label}  $${row.point.usd.toFixed(2)}`}
                  </SvgText>
                </Fragment>
              ) : null,
            )}
            {extra > 0 && (
              <SvgText
                x={padLConst + 20}
                y={padT + 27 + rows.filter((r) => r.point).length * 13}
                fontSize={9}
                fill={colors.muted}
              >
                {`+${extra} more`}
              </SvgText>
            )}
            {void formatPrice && null}
          </>
        );
      })()}
```

NOTE: drop the `{void formatPrice && null}` line and the `formatPrice` import if prices are rendered via `$usd.toFixed(2)` (matching the axis style) — keep imports clean; final code must not reference unused symbols.

- [ ] **Step 2: Verify**

Run: `pnpm check` — 0 errors.
Run: `pnpm lint` — no new errors.
Run: `pnpm test` — all pass.

- [ ] **Step 3: Update `todo.md`**

Append Phase 88 section:

```markdown
## Phase 88: Chart Scrubbing (v5.36)

- [x] Add indexForLocationX + nearestByX helpers with tests
- [x] Drag scrubbing on product detail price history chart
- [x] Crosshair + multi-distributor tooltip on compare chart
```

- [ ] **Step 4: Commit and push**

```bash
git add components/compare/multi-line-chart.tsx todo.md && git commit -m "feat: crosshair scrubbing on compare chart"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New helpers | `indexForLocationX`, `nearestByX` (+5 test cases) |
| Modified | both chart components |
| New deps | none |
