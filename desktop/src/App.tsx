import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, useNavigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function HeaderBar() {
  const connection = useConnection();
  const navigate = useNavigate();
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
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Press ⌘K to search
        </span>
      </div>
    </div>
  );
}

function KeyboardShortcuts({
  setSearchModalOpen,
}: {
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const { toggle } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

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
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchModalOpen, navigate, toggle]);

  return null;
}

export default function App() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
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
      await syncDesktopNotifications();
    };
    void run();
    const timer = setInterval(() => {
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
          />
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
