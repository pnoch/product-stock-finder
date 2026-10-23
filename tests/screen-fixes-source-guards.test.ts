import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Source guards for screen/hook fixes with no component-level harness. Each
// assertion corresponds to a behaviour change; reverting the fix fails it.
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("screen-level fixes", () => {
  it("the tag picker only resyncs when the product changes", () => {
    const src = read("components/tag-picker-sheet.tsx");
    // Inline product objects (trending picker) change identity every render,
    // which used to clear the user's checks mid-edit.
    expect(src).toContain("syncedProductIdRef");
    expect(src).toContain("if (syncedProductIdRef.current === product.id) return;");
    expect(src).toContain("if (!visible) syncedProductIdRef.current = null;");
  });

  it("the toast only hides when its exit animation finished", () => {
    const src = read("components/ui/toast.tsx");
    // A new toast started during the exit stops that animation
    // (finished === false); hiding unconditionally then swallowed it.
    expect(src).toContain(".start(({ finished }) => {");
    expect(src).toContain("if (finished) setToast((prev) => ({ ...prev, visible: false }));");
  });

  it("the route error boundary never throws from getDerivedStateFromError", () => {
    const src = read("components/route-error-boundary.tsx");
    const start = src.indexOf("static getDerivedStateFromError");
    const block = src.slice(start, src.indexOf("componentDidCatch", start));
    expect(block.indexOf("try {")).toBeLessThan(block.indexOf("catch"));
    expect(block).toContain("truncated = Array.from(String(msg)).slice(0, 160).join");
  });

  it("useLiveProduct clears loaded when the product id changes", () => {
    const src = read("hooks/use-live-prices.ts");
    const start = src.indexOf("const loadSeed");
    const block = src.slice(start, src.indexOf("setLoaded(true)", start));
    // Without the reset the persist effect could write the previous product's
    // listings under the new id.
    expect(block).toContain("setLoaded(false)");
  });

  it("the compare screen latches the selection on manual/param changes", () => {
    const src = read("hooks/use-compare-screen.ts");
    // The default selection is derived from the distributor deep link or the
    // top-3 by price; manual toggles take over via userSelected.
    expect(src).toContain("const [userSelected, setUserSelected]");
    expect(src).toContain("const selected = userSelected ?? latchedDefault");
    expect(src).toContain("new Set([distributorParam])");
    expect(src).toContain("setUserSelected((prev) =>");
  });

  it("a failed settings write re-reads the store instead of a stale snapshot", () => {
    const provider = read("lib/settings-provider.tsx");
    expect(provider).toContain("setSettings(await getSettings());");
    const screen = read("app/(tabs)/settings.tsx");
    expect(screen).toContain("saveSetting(key, value)");
  });

  it("the device list only spins on its first load", () => {
    const src = read("components/settings/device-management/use-device-management.ts");
    expect(src).toContain("devicesInitializedRef");
    expect(src).toContain("if (devicesInitializedRef.current) setDevicesRefreshing(true);");
  });

  it("the alerts data and notification center watch storage changes", () => {
    for (const file of [
      "hooks/use-alerts-data.ts",
      "components/notification-center.tsx",
    ]) {
      const src = read(file);
      expect(src, `${file} must subscribe`).toContain("subscribeToStorageChanges(");
    }
    // The notification center also guards overlapping loads.
    expect(read("components/notification-center.tsx")).toContain("loadGen");
  });

  it("mobile search reads discovered products from the store, not the static catalog", () => {
    const src = read("hooks/use-catalog-search.ts");
    // getAllCatalog() is static-only, so filtering it by its own ids always
    // produced [] — discovered products were stored but never listed on mobile.
    expect(src).toContain("getDiscoveredProducts()");
    expect(src).toContain("PRODUCT_CATALOG, ...(await getDiscoveredProducts())");
  });

  it("AI discovery also discovers listings, like the catalog-add path", () => {
    const src = read("lib/add-product.ts");
    // Without this the product opened with no distributor rows and no price.
    expect(src).toContain("rediscoverProduct({");
  });

  it("the rates screen guards against an out-of-order load", () => {
    const src = read("app/(tabs)/rates.tsx");
    // The mount effect calls loadData twice concurrently (immediately and after
    // maybeRefreshFxRates), so the earlier read could land last with stale rates.
    expect(src).toContain("loadGenRef");
    expect(src).toContain("if (gen !== loadGenRef.current) return;");
  });

  it("the home screen guards against an out-of-order load", () => {
    const src = read("hooks/use-home-data.ts");
    // Focus + pull-to-refresh can run loadData concurrently; the earlier
    // watchlist/alerts/settings/last-seen read could land last and overwrite newer state.
    expect(src).toContain("loadGenRef");
    // Guarded after each of the three reads, plus the catch.
    expect(src.split("if (gen !== loadGenRef.current) return;").length - 1).toBe(4);
  });

  it("the launch price check runs only after the app UI (and webview host) mounts", () => {
    const src = read("app/_layout.tsx");
    // Running it in the mount effect raced the hidden WebView host: during
    // onboarding the host isn't mounted, so the check was plain-HTTP only.
    expect(src).toContain("launchCheckRanRef");
    expect(src).toContain('onboardingState !== "app" || launchCheckRanRef.current');
  });

  it("the mobile verify-email refresh sends the Bearer token", () => {
    const src = read("app/verify-email.tsx");
    // On React Native the session cookie is not reliably sent cross-origin, so
    // /api/auth/me 401'd and the "verify your email" banner never cleared.
    expect(src).toContain("Auth.getSessionToken()");
    expect(src).toContain("Authorization: `Bearer ${sessionToken}`");
  });

  it("the health detail screen guards against an out-of-order load", () => {
    const src = read("app/health/[id].tsx");
    // `id` comes from the route params, so navigating between two distributors
    // re-runs the load while the previous one is in flight; the older result
    // could land last and show the wrong distributor's samples.
    expect(src).toContain("loadGenRef");
    // Both awaits must be guarded (the samples read and the status read), so
    // count the checks rather than merely finding the string once.
    expect(src.split("if (gen !== loadGenRef.current) return;").length - 1).toBe(2);
  });

  it("backup import re-reads and merges at save time, stamping per collection", () => {
    for (const file of [
      "components/settings/data-section.tsx",
      "desktop/src/components/settings/data-settings-section.tsx",
    ]) {
      const src = read(file);
      // The snapshot taken before the confirm dialog is stale by the time the
      // user accepts; saving it reverted a concurrent price check / sync pull.
      expect(src, file).toContain("const fresh = applyBackup(backup, {");
      expect(src, file).toContain("fresh.touchedIds.watchlist");
      // Per-collection stamping: a later failure must not leave imported data
      // that never syncs.
      expect(src, file).toMatch(
        /saveWatchlist\(fresh\.watchlist\);[\s\S]{0,200}setItemSyncMeta\("watchlist"/,
      );
    }
  });

  it("bulk-import summaries count only writes that landed", () => {
    // addToWatchlist RESOLVES false for a duplicate, so a fulfilled-status check
    // alone over-reported the import.
    expect(read("components/search/bulk-import-modal.tsx")).toContain(
      'r.status === "fulfilled" && r.value === true',
    );
    for (const file of [
      "desktop/src/hooks/use-bulk-import.ts",
      "desktop/src/components/SearchModal.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toContain("PromiseFulfilledResult<boolean>");
      expect(src, file).toContain(".value === true");
    }
  });

  it("AI discovery reports an already-tracked product instead of claiming success", () => {
    const add = read("lib/add-product.ts");
    const src = read("app/search.tsx");
    expect(add).toContain("await addToWatchlist(");
    expect(src).toContain('"Already tracked"');
  });
});
