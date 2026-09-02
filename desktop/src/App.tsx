import { useState, useEffect, useRef, useId } from "react";
import { HashRouter, Routes, Route, useNavigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { SearchModal } from "./components/SearchModal";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { useConnection } from "./hooks/use-connection";
import { Home } from "./pages/Home";
import { Watchlist } from "./pages/Watchlist";
import { ProductDetail } from "./pages/ProductDetail";
import { Compare } from "./pages/Compare";
import { Alerts } from "./pages/Alerts";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { Health } from "./pages/Health";
import { HealthDetail } from "./pages/HealthDetail";
import { RestockWatches } from "./pages/RestockWatches";
import { DistributorAnalysis } from "./pages/DistributorAnalysis";
import { Stats } from "./pages/Stats";
import { exportWatchlistAsJson } from "./import-export";
import { useTheme } from "./hooks/use-theme";
import { onPricesChecked } from "./background";
import { maybeSendDigest } from "../../lib/price-digest";
import { useAuth } from "./hooks/use-auth";
import { trpc, createTRPCClient } from "./lib/trpc";
import { setupSync, type SyncSetup } from "../../lib/sync";
import { storage } from "./storage";
import { syncDesktopNotifications } from "./server-notifications";

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">The page you requested does not exist.</p>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

function HeaderBar() {
  const connection = useConnection();
  const navigate = useNavigate();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
  const searchHint = isMac ? "⌘K" : "Ctrl+K";
  return (
    <div className="h-14 shrink-0 hidden lg:flex items-center px-6 border-b border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm sticky top-0 z-10">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Product Stock Finder
      </span>
      <div className="ml-auto flex items-center gap-3">
        <ConnectionBadge
          status={connection.status}
          onPress={
            connection.status === "signed-out"
              ? () => navigate("/settings")
              : undefined
          }
        />
        <span
          className="text-xs text-gray-400 dark:text-gray-500"
          title={`Press ${searchHint} to search — ${isMac ? "Cmd" : "Ctrl"}+K, ${isMac ? "Cmd" : "Ctrl"}+, for settings, ${isMac ? "Cmd" : "Ctrl"}+Shift+T to toggle theme`}
          aria-label={`Keyboard shortcuts: ${searchHint} search, ${isMac ? "Cmd" : "Ctrl"} comma settings, ${isMac ? "Cmd" : "Ctrl"} Shift T toggle theme`}
        >
          Press {searchHint} to search
        </span>
      </div>
    </div>
  );
}

function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl";
  if (!open) return null;
  const shortcuts = [
    { keys: [mod, "K"], label: "Search products" },
    { keys: [mod, ","], label: "Open Settings" },
    { keys: [mod, "Shift", "T"], label: "Toggle theme" },
    { keys: [mod, "E"], label: "Export watchlist" },
    { keys: ["?"], label: "Show shortcuts" },
    { keys: ["Esc"], label: "Close dialog" },
  ];
  // focus trap + restore
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (focusable[0] as HTMLElement | undefined)?.focus();
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const dialogEl = dialogRef.current;
        if (!dialogEl) return;
        const focusable = Array.from(dialogEl.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (previousActiveRef.current) previousActiveRef.current.focus();
    };
  }, [open, onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={dialogRef} tabIndex={-1} className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 animate-scaleIn outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" aria-label="Close shortcuts"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <span className="text-sm text-gray-600 dark:text-gray-300">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">Press <kbd className="px-1 py-0.5 rounded border bg-gray-50 dark:bg-gray-700 text-[10px]">?</kbd> or <kbd className="px-1 py-0.5 rounded border bg-gray-50 dark:bg-gray-700 text-[10px]">Esc</kbd> to close</p>
      </div>
    </div>
  );
}

function KeyboardShortcuts({
  setSearchModalOpen,
  setShortcutsOpen,
}: {
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const { toggle } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (!isTyping && e.key === "?" && !isMeta) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (isMeta && e.key === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      } else if (isMeta && e.key === "e") {
        e.preventDefault();
        exportWatchlistAsJson();
      } else if (isMeta && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
      } else if (isMeta && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setSearchModalOpen(false);
        setShortcutsOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchModalOpen, setShortcutsOpen, navigate, toggle]);

  return null;
}

export default function App() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());
  const { isAuthenticated } = useAuth();
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;
  const syncRef = useRef<SyncSetup | null>(null);

  useEffect(() => {
    syncRef.current = setupSync({
      storage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
  }, [trpcClient]);

  useEffect(() => {
    if (isAuthenticated) syncRef.current?.syncNow();
  }, [isAuthenticated]);

  useEffect(() => {
    const unlistenPromise = onPricesChecked(async () => {
      try {
        const settings = await storage.getSettings();
        const frequency = settings.digestFrequency ?? "off";
        if (frequency === "off") return;
        const prevDigest = await storage.getPriceDigestSnapshot();
        const nextDigest = await maybeSendDigest(
          prevDigest,
          await storage.getWatchlist(),
          settings,
          await storage.getAlerts(),
          async (title, body) => {
            const { sendDesktopNotification } = await import("./notifications");
            await sendDesktopNotification(title, body);
          },
        );
        if (nextDigest) await storage.savePriceDigestSnapshot(nextDigest);
      } catch {
        // digest failures are non-fatal
      }
    }).catch(() => () => {});
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      if (!isAuthenticatedRef.current) return;
      await syncDesktopNotifications();
    };
    void run();
    const timer = setInterval(() => {
      if (!isAuthenticatedRef.current) return;
      void run();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAuthenticated]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <KeyboardShortcuts
            setSearchModalOpen={setSearchModalOpen}
            setShortcutsOpen={setShortcutsOpen}
          />
          <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
          <SearchModal
            open={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
          />
          <div className="flex h-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-900/20">
              <div className="min-h-full flex flex-col">
                <HeaderBar />
                <div className="flex-1 w-full max-w-6xl mx-auto">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/watchlist" element={<Watchlist />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/compare/:id" element={<Compare />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/health" element={<Health />} />
                    <Route path="/health/:id" element={<HealthDetail />} />
                    <Route path="/restock-watches" element={<RestockWatches />} />
                    <Route
                      path="/distributor-analysis"
                      element={<DistributorAnalysis />}
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </div>
            </main>
          </div>
        </HashRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
