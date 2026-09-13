import "@testing-library/jest-dom/vitest";

// React Native global used by shared lib modules (lib/_core/auth.ts, api.ts).
// Mirrors root tests/setup.ts. The vite `define` for __DEV__ does not reliably
// reach ../lib/* modules under vitest (worker-dependent transform path), which
// caused flaky `ReferenceError: __DEV__ is not defined` suite failures.
(globalThis as Record<string, unknown>).__DEV__ = true;

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Mock ResizeObserver for components (e.g. Recharts ResponsiveContainer).
  // Reports a fixed size so ResponsiveContainer can render in jsdom.
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback(
        [
          {
            contentRect: { width: 400, height: 300 },
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });

  // Mock Tauri internals so pages that call invoke() don't throw
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    writable: true,
    value: {
      transformCallback: (callback: unknown) => callback,
      invoke: () => Promise.resolve(),
      postMessage: () => {},
    },
  });

  // Mock Tauri event plugin internals for listen()/unlisten()
  Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
    writable: true,
    value: {
      unregisterListener: () => {},
      registerListener: () => {},
    },
  });
}
