import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./components/Sidebar";
import { SearchModal } from "./components/SearchModal";
import { Home } from "./pages/Home";
import { Watchlist } from "./pages/Watchlist";
import { ProductDetail } from "./pages/ProductDetail";
import { Compare } from "./pages/Compare";
import { Alerts } from "./pages/Alerts";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { Health } from "./pages/Health";
import { RestockWatches } from "./pages/RestockWatches";
import { DistributorAnalysis } from "./pages/DistributorAnalysis";
import { exportWatchlistAsJson } from "./import-export";
import { useTheme } from "./hooks/use-theme";
import { startPricePoller, onPricesChecked } from "./background";
import { maybeSendDigest } from "../../lib/price-digest";
import { useAuth } from "./hooks/use-auth";
import { trpc, createTRPCClient } from "./lib/trpc";
import { setupSync, type SyncSetup } from "../../lib/sync";
import { storage } from "./storage";
import { getApiBaseUrl } from "./lib/api-base";
import { syncDesktopNotifications } from "./server-notifications";

function KeyboardShortcuts({ searchModalOpen, setSearchModalOpen }: { searchModalOpen: boolean; setSearchModalOpen: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { toggle } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key === "k") {
        e.preventDefault();
        setSearchModalOpen(!searchModalOpen);
      } else if (isMeta && e.key === "e") {
        e.preventDefault();
        exportWatchlistAsJson();
      } else if (isMeta && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
      } else if (isMeta && e.shiftKey && e.key === "T") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setSearchModalOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchModalOpen, setSearchModalOpen, navigate, toggle]);

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
    let cancelled = false;
    (async () => {
      const settings = await storage.getSettings();
      if (cancelled) return;
      if (settings.checkInterval === "manual") return;
      const intervalMinutes =
        settings.checkInterval === "hourly" ? 60 : 1440;
      await startPricePoller(intervalMinutes, getApiBaseUrl());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unlisten = onPricesChecked(async () => {
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
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
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
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <KeyboardShortcuts searchModalOpen={searchModalOpen} setSearchModalOpen={setSearchModalOpen} />
          <SearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
          <div className="flex h-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/compare/:id" element={<Compare />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/search" element={<Search />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/health" element={<Health />} />
                <Route path="/restock-watches" element={<RestockWatches />} />
                <Route path="/distributor-analysis" element={<DistributorAnalysis />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
