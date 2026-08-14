# Push Token Pruning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead Expo push tokens from `device_push_tokens` (and the in-memory fallback) when a push send returns a `DeviceNotRegistered` ticket, so rows for uninstalled devices stop accumulating.

**Architecture:** Add a `pruneDeviceToken(deviceId)` helper that deletes the token row via the DB or removes it from the memory map (best-effort, never throws). In `sendPushForDevice`, capture the tickets returned by `expo.sendPushNotificationsAsync` and prune when any ticket reports `status === "error"` with `details.error === "DeviceNotRegistered"`. Other error codes are ignored; ok tickets leave the row alone.

**Tech Stack:** TypeScript 5.9 (strict), Express/tRPC/Drizzle server, expo-server-sdk, vitest.

---

## File Structure

- Modify: `server/push-notifications.ts` — add `pruneDeviceToken(deviceId)` export; inspect send tickets in `sendPushForDevice`.
- Modify: `tests/push-notifications.test.ts` — hoisted ticket state + ticket-returning expo mock; add `delete` to `dbStub`; 3 helper tests + 4 ticket-inspection tests.
- Modify: `todo.md` — append Phase 35 section (checkpoint task).

## Test baseline (must all stay green)

- `pnpm check` — 0 TypeScript errors
- `pnpm lint` — clean (pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning only)
- `pnpm test` — all root tests
- `pnpm check:desktop` + `pnpm --filter desktop test` — desktop gates

---

### Task 1: Add `pruneDeviceToken` helper

**Files:**

- Modify: `server/push-notifications.ts`
- Test: `tests/push-notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/push-notifications.test.ts`, make three changes:

**(a)** Add a hoisted ticket store at the top (after the existing imports, before the db mock — it must be declared before the `vi.mock("expo-server-sdk", ...)` factory):

```ts
const pushState = vi.hoisted(() => ({
  tickets: [{ status: "ok" }] as Array<{
    status: string;
    details?: { error?: string };
  }>,
}));
```

**(b)** Change the `expo-server-sdk` mock so `sendPushNotificationsAsync` returns the hoisted tickets (add the `return pushState.tickets;` line):

```ts
vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken = (value: unknown) =>
      typeof value === "string" && value.startsWith("ExponentPushToken");
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    async sendPushNotificationsAsync(chunk: unknown) {
      sent.push(chunk);
      return pushState.tickets;
    }
  },
}));
```

**(c)** Add a `delete` stub to `dbStub` (after the `select` property):

```ts
const dbStub = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onDuplicateKeyUpdate: vi.fn(async () => undefined),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => [{ token: "ExponentPushToken[dbpath]" }]),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(async () => undefined),
  })),
};
```

**(d)** Update `beforeEach` to reset tickets and mock call history:

```ts
beforeEach(() => {
  clearPushTokensForTests();
  sent.length = 0;
  pushState.tickets = [{ status: "ok" }];
  vi.clearAllMocks();
  mockedGetDb.mockResolvedValue(dbStub as never);
});
```

**(e)** Add a `pruneDeviceToken` import to the existing import line:

```ts
import {
  upsertPushToken,
  sendPushForDevice,
  pruneDeviceToken,
  clearPushTokensForTests,
} from "../server/push-notifications";
```

**(f)** Append these three tests at the end of the `describe("push-notifications", ...)` block:

```ts
it("pruneDeviceToken removes the token from the memory store", async () => {
  mockedGetDb.mockResolvedValue(null);
  await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
  await pruneDeviceToken("dev-1");
  await sendPushForDevice("dev-1", [event]);
  expect(sent).toHaveLength(0);
});

it("pruneDeviceToken deletes the row through the database", async () => {
  await pruneDeviceToken("dev-1");
  expect(dbStub.delete).toHaveBeenCalledWith(devicePushTokens);
});

it("pruneDeviceToken never throws when the database delete fails", async () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  mockedGetDb.mockResolvedValue({
    delete: vi.fn(() => {
      throw new Error("db down");
    }),
  } as never);
  await expect(pruneDeviceToken("dev-1")).resolves.toBeUndefined();
  expect(warnSpy).toHaveBeenCalled();
  warnSpy.mockRestore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/push-notifications.test.ts`
Expected: FAIL — `pruneDeviceToken is not a function` (not yet exported from `server/push-notifications.ts`).

- [ ] **Step 3: Implement the minimal code**

In `server/push-notifications.ts`, add `pruneDeviceToken` after `sendPushForDevice` (before `clearPushTokensForTests`):

```ts
export async function pruneDeviceToken(deviceId: string): Promise<void> {
  try {
    const db = await getDb();
    if (db) {
      await db
        .delete(devicePushTokens)
        .where(eq(devicePushTokens.deviceId, deviceId));
    } else {
      memoryTokens.delete(deviceId);
    }
  } catch (error) {
    console.warn(
      `[Push] Failed to prune push token for device ${deviceId}:`,
      error,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/push-notifications.test.ts`
Expected: PASS — all existing tests plus the 3 new helper tests green.

- [ ] **Step 5: Commit**

```bash
git add server/push-notifications.ts tests/push-notifications.test.ts
git commit -m "feat(push): add pruneDeviceToken helper"
```

---

### Task 2: Prune on DeviceNotRegistered send tickets

**Files:**

- Modify: `server/push-notifications.ts`
- Test: `tests/push-notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these four tests at the end of the `describe("push-notifications", ...)` block in `tests/push-notifications.test.ts`:

```ts
it("deletes the token row when a send ticket reports DeviceNotRegistered", async () => {
  pushState.tickets = [
    { status: "error", details: { error: "DeviceNotRegistered" } },
  ];
  await sendPushForDevice("dev-1", [event]);
  expect(dbStub.delete).toHaveBeenCalledWith(devicePushTokens);
});

it("does not delete when all send tickets are ok", async () => {
  pushState.tickets = [{ status: "ok" }];
  await sendPushForDevice("dev-1", [event]);
  expect(dbStub.delete).not.toHaveBeenCalled();
});

it("does not delete on other error codes", async () => {
  pushState.tickets = [
    { status: "error", details: { error: "MessageTooBig" } },
  ];
  await sendPushForDevice("dev-1", [event]);
  expect(dbStub.delete).not.toHaveBeenCalled();
});

it("prunes the memory token when a send ticket reports DeviceNotRegistered", async () => {
  mockedGetDb.mockResolvedValue(null);
  await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
  pushState.tickets = [
    { status: "error", details: { error: "DeviceNotRegistered" } },
  ];
  await sendPushForDevice("dev-1", [event]);
  expect(sent).toHaveLength(1);
  pushState.tickets = [{ status: "ok" }];
  await sendPushForDevice("dev-1", [event]);
  expect(sent).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/push-notifications.test.ts`
Expected: FAIL — first test (`deletes the token row ...`) fails because `dbStub.delete` is never called (sendPushForDevice still discards tickets); `sent` mock is unchanged.

- [ ] **Step 3: Implement the ticket inspection**

In `server/push-notifications.ts`, modify the send loop inside `sendPushForDevice`:

```ts
for (const chunk of expo.chunkPushNotifications(messages)) {
  const tickets = await expo.sendPushNotificationsAsync(chunk);
  if (
    tickets.some(
      (t) => t.status === "error" && t.details?.error === "DeviceNotRegistered",
    )
  ) {
    await pruneDeviceToken(deviceId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/push-notifications.test.ts`
Expected: PASS — 11 tests total (7 existing + 3 Task 1 + 4 Task 2, minus none).

- [ ] **Step 5: Commit**

```bash
git add server/push-notifications.ts tests/push-notifications.test.ts
git commit -m "feat(push): prune tokens on DeviceNotRegistered send tickets"
```

---

### Task 3: Full verification + checkpoint

**Files:**

- Modify: `todo.md`

- [ ] **Step 1: Run the full verification gates**

Run each and confirm:

```bash
pnpm check
# Expected: 0 TypeScript errors

pnpm lint
# Expected: clean (pre-existing MODULE_TYPELESS_PACKAGE_JSON warning only)

pnpm test
# Expected: all root tests pass (68 files / ~431 tests — 7 new in push-notifications.test.ts)

pnpm check:desktop
# Expected: 0 errors

pnpm --filter desktop test
# Expected: 35 tests pass
```

If any gate fails, fix and re-run before committing.

- [ ] **Step 2: Update todo.md**

Append a new phase section at the end of `todo.md`:

```md
## Phase 35: Push Token Pruning

- [x] pruneDeviceToken (DB delete + memory removal, best-effort)
- [x] Send-ticket inspection: DeviceNotRegistered prunes the token row
- [x] Tests: dead/ok/other-error tickets, memory path, never-throws
```

- [ ] **Step 3: Commit the checkpoint**

```bash
git add todo.md
git commit -m "Checkpoint: v3.14: Prune dead Expo push tokens on DeviceNotRegistered send tickets. TypeScript: 0 errors."
```

---

## Self-Review Notes

- **Spec coverage:** `pruneDeviceToken` (Task 1), send-ticket inspection with only-`DeviceNotRegistered` triggering and the unchanged warn/swallow contract (Task 2), all 5 spec tests present (Task 1 covers memory removal + DB delete + never-throws; Task 2 covers dead/ok/other-error + memory end-to-end), Phase 35 todo section (Task 3). No schema/migration/mobile/desktop changes anywhere.
- **Placeholder scan:** every step has exact code, paths, commands, and expected output.
- **Type consistency:** `pruneDeviceToken(deviceId: string): Promise<void>` used identically in Task 1 and Task 2; `pushState.tickets` shape matches the Expo `PushTicket` `{ status, details?: { error? } }` contract; `t.details?.error` optional chain is correct because `details` is optional.
