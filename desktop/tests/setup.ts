import "@testing-library/jest-dom/vitest";

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

  // Mock Tauri internals so pages that call invoke() don't throw
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    writable: true,
    value: {
      transformCallback: (callback: unknown) => {
        if (typeof callback === "function") {
          return callback;
        }
        return callback;
      },
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
