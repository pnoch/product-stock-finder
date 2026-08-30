# Route-Level Error Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-route error boundaries so a crash in one screen doesn't kill the whole app.

**Architecture:** Create a reusable `RouteErrorBoundary` component and export it from 5 high-risk route files. Expo Router natively supports this pattern.

**Tech Stack:** React class components, Expo Router

---

### Task 1: Create RouteErrorBoundary component

**Files:**
- Create: `components/route-error-boundary.tsx`

- [ ] **Step 1: Read AppErrorBoundary for pattern**

Read `components/app-error-boundary.tsx` to match the existing error boundary pattern.

- [ ] **Step 2: Create RouteErrorBoundary**

Create `components/route-error-boundary.tsx`:

```typescript
import React from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message.slice(0, 120) };
  }

  componentDidCatch(error: Error) {
    console.error("[RouteErrorBoundary]", error);
    void AsyncStorage.setItem("last_error", error.message).catch(() => {});
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700" }}>
          Something went wrong
        </Text>
        <Text style={{ marginTop: 8, color: "#666", textAlign: "center" }}>
          {this.state.message}
        </Text>
        <TouchableOpacity
          onPress={() => this.setState({ hasError: false, message: "" })}
          style={{
            marginTop: 16,
            backgroundColor: "#0F52BA",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <Text style={{ color: "#fff" }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 8 }}
        >
          <Text>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
```

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/route-error-boundary.tsx
git commit -m "feat: add RouteErrorBoundary component"
```

---

### Task 2: Export ErrorBoundary from 5 route files

**Files:**
- Modify: `app/product/[id].tsx`
- Modify: `app/compare/[id].tsx`
- Modify: `app/search.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/alerts.tsx`

- [ ] **Step 1: Add export to product/[id].tsx**

Add at the end of `app/product/[id].tsx`:

```typescript
export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
```

- [ ] **Step 2: Add export to compare/[id].tsx**

Add at the end of `app/compare/[id].tsx`:

```typescript
export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
```

- [ ] **Step 3: Add export to search.tsx**

Add at the end of `app/search.tsx`:

```typescript
export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
```

- [ ] **Step 4: Add export to settings.tsx**

Add at the end of `app/(tabs)/settings.tsx`:

```typescript
export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
```

- [ ] **Step 5: Add export to alerts.tsx**

Add at the end of `app/(tabs)/alerts.tsx`:

```typescript
export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
```

- [ ] **Step 6: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add app/product/\[id\].tsx app/compare/\[id\].tsx app/search.tsx app/(tabs)/settings.tsx app/(tabs)/alerts.tsx
git commit -m "feat: add route-level error boundaries to 5 high-risk routes"
```

---

### Task 3: Verify full test suite

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

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: All tests pass
