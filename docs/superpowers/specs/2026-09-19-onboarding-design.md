# Onboarding — Design Spec

**Date:** 2026-09-19
**Goal:** First-launch 3-slide intro (Welcome / Add Anything / Never Miss a Drop) gated before the app renders; completion persists via the legacy `has_seen_onboarding` key.

## Module (lib/onboarding.ts)

Standalone injectable module, key `has_seen_onboarding`:

```typescript
export async function hasSeenOnboarding(store = AsyncStorage): Promise<boolean>
export async function setOnboardingSeen(store = AsyncStorage): Promise<void>
```

(`clearAllData` already removes the key → clearing data re-triggers onboarding, acceptable.)

## Screen (components/onboarding/onboarding-screen.tsx)

Props `{ onComplete: () => void }`. Full-screen, brand background:
- Horizontal paging FlatList of 3 slides: emoji icon, title, body copy
- Page dots
- Skip (top-right) and Next / Get Started button; last slide's button calls `setOnboardingSeen()` then `onComplete()`

Slide data:
1. 🛒 "Track Prices Everywhere" — "Monitor products across 25 global distributors in one watchlist."
2. ✨ "Add Anything" — "Search the catalog, paste a list of model numbers, or add any product manually with AI."
3. 🔔 "Never Miss a Drop" — "Price alerts, restock watches, and weekly digests keep you ahead."

## Gate (app/_layout.tsx)

After existing hooks, before the two return paths:

```typescript
const [onboardingState, setOnboardingState] = useState<"checking" | "app" | "intro">("checking");
useEffect(() => {
  void hasSeenOnboarding().then((seen) =>
    setOnboardingState(seen ? "app" : "intro"),
  );
}, []);
if (onboardingState === "checking") {
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
if (onboardingState === "intro") {
  return (
    <ThemeProvider>
      <OnboardingScreen onComplete={() => setOnboardingState("app")} />
    </ThemeProvider>
  );
}
```

(Adapt to both existing return variants — gate sits before them so only one copy is needed if placed early; verify hooks order is preserved.)

## Testing

Module tests with in-memory store.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/onboarding.ts` | new (~30 lines) |
| `tests/onboarding.test.ts` | new |
| `components/onboarding/onboarding-screen.tsx` | new (~160 lines) |
| `app/_layout.tsx` | gate wiring |
| `todo.md` | append Phase 103 |
