# Notification Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping any notification routes to its target — product notifications open `/product/{id}`, digest opens `/stats`, health opens `/health`.

**Architecture:** Add optional `productId` to local notification payloads; extend `scheduleServerEventNotification` with a data param; handle notification responses in `_layout` via expo-router's standalone `router`.

**Tech Stack:** expo-notifications, expo-router 6, TypeScript strict.

---

## File Structure

| File | Change |
|------|--------|
| `lib/notifications.ts` | payload plumbing |
| `app/_layout.tsx` | response routing |
| `lib/restock.ts`, `app/product/[id].tsx`, `app/compare/[id].tsx`, `lib/server-notifications.ts` | pass productId |

---

## Task 1: Plumbing + routing + push

**Files:** all of the above + `todo.md`

- [ ] **Step 1: Payload plumbing in `lib/notifications.ts`**

1. `scheduleStockAlert` — signature gains trailing `productId?: string`; in `content.data` add `productId`:
```typescript
export async function scheduleStockAlert(
  productName: string,
  distributorName: string,
  price: number,
  currency: string,
  productId?: string,
): Promise<string | null> {
```
data becomes: `data: { type: "stock_alert", productName, distributorName, productId },`

2. `schedulePriceAlert` — same pattern:
```typescript
export async function schedulePriceAlert(
  productName: string,
  targetPrice: number,
  currency: string,
  productId?: string,
): Promise<string | null> {
```
data: `data: { type: "price_alert", productName, targetPrice, currency, productId },`

3. `scheduleBackOrderReminder`:
```typescript
export async function scheduleBackOrderReminder(
  productName: string,
  distributorName: string,
  reminderDate: Date,
  productId?: string,
): Promise<string | null> {
```
data: `data: { type: "back_order_reminder", productName, distributorName, productId },`

4. `sendPriceDigestNotification` — add to content: `data: { type: "digest" },`

5. `scheduleServerEventNotification` — signature gains `data?: Record<string, unknown>`; merge into content.data on both web/native paths where a notification is created:
```typescript
export async function scheduleServerEventNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
```
native content: `data: { type: "server_event", ...(data ?? {}) },`

- [ ] **Step 2: Tap routing in `app/_layout.tsx`**

1. Add import: `import { router } from "expo-router";` (standalone router — merge with the existing expo-router import if one exists).
2. In the notifications setup effect (where dedup listeners are registered), add response handling:

```typescript
    const handledResponses = new Set<string>();
    const handleResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      const id = response.notification.request.identifier;
      if (handledResponses.has(id)) return;
      handledResponses.add(id);
      const data = response.notification.request.content.data as {
        productId?: string;
        type?: string;
      };
      if (data.productId) {
        router.push(`/product/${data.productId}`);
      } else if (data.type === "digest") {
        router.push("/stats");
      } else if (data.type?.startsWith("health")) {
        router.push("/health");
      }
    };
    subscriptions.push(
      Notifications.addNotificationResponseReceivedListener(handleResponse),
    );
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch(() => {});
```

(The existing dedup listener subscriptions stay unchanged; this adds parallel handling.)

- [ ] **Step 3: Pass productId at call sites**

1. `lib/restock.ts:51` — stock alert for a watched product; pass its productId (available in scope as the watch/product object — inspect and use).
2. `app/product/[id].tsx:155` — stock-alert confirmation: pass `id`.
3. `app/product/[id].tsx:250` — price-alert confirmation: pass `id`.
4. `app/product/[id].tsx:416` — stock watch confirmation: pass `id`.
5. `app/product/[id].tsx:443` — back-order reminder: pass `id`.
6. `app/product/[id].tsx:485` — cross-distributor price alert: pass `id`.
7. `app/compare/[id].tsx:136` — compare-screen alert: pass `id`.
8. `lib/server-notifications.ts:158`:
```typescript
        await scheduleServerEventNotification(event.title, event.body, {
          productId: event.productId,
        });
```
(`event.productId` exists on pulled events.)

- [ ] **Step 4: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Update `todo.md` + commit + push**

Append Phase 100 section:

```markdown
## Phase 100: Notification Deep Links (v6.0)

- [x] Carry productId in all product notification payloads
- [x] Route notification taps to product/stats/health screens
- [x] Server-pulled events preserve productId through local re-scheduling
```

Then:

```bash
git add lib/notifications.ts lib/restock.ts lib/server-notifications.ts app/_layout.tsx app/product/\[id\].tsx app/compare/\[id\].tsx todo.md && git commit -m "feat: deep-link notifications to their screens"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| Payload change | +productId on all product notifications |
| Routing | product / stats / health by payload |
| Callers updated | 8 sites |
