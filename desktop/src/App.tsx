import { useState, lazy, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./components/Sidebar";
import { SearchModal } from "./components/SearchModal";
import { OnboardingModal, useOnboardingModal } from "./components/OnboardingModal";
import { useAuth } from "./hooks/use-auth";
import { useAppBootstrap } from "./hooks/use-app-bootstrap";
import { NotFound } from "./components/app/NotFound";
import { HeaderBar } from "./components/app/HeaderBar";
import { ShortcutsOverlay } from "./components/app/ShortcutsOverlay";
import { KeyboardShortcuts } from "./components/app/KeyboardShortcuts";
import { NotificationRouter } from "./components/app/NotificationRouter";
import { ConfirmHost } from "./components/app/ConfirmHost";
import { trpc, trpcHeaders } from "./lib/trpc";
import { setDiscoveryHeadersProvider } from "../../lib/llm-discovery";

// Routes are lazy so each page (Settings and Stats are large) is its own chunk
// instead of loading the whole app up front. The named-export -> default map is
// required because the pages use named exports.
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const Watchlist = lazy(() =>
  import("./pages/Watchlist").then((m) => ({ default: m.Watchlist })),
);
const ProductDetail = lazy(() =>
  import("./pages/ProductDetail").then((m) => ({ default: m.ProductDetail })),
);
const Compare = lazy(() =>
  import("./pages/Compare").then((m) => ({ default: m.Compare })),
);
const Alerts = lazy(() =>
  import("./pages/Alerts").then((m) => ({ default: m.Alerts })),
);
const Drops = lazy(() =>
  import("./pages/Drops").then((m) => ({ default: m.Drops })),
);
const Search = lazy(() =>
  import("./pages/Search").then((m) => ({ default: m.Search })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const Rates = lazy(() =>
  import("./pages/Rates").then((m) => ({ default: m.Rates })),
);
const Stats = lazy(() =>
  import("./pages/Stats").then((m) => ({ default: m.Stats })),
);
const Health = lazy(() =>
  import("./pages/Health").then((m) => ({ default: m.Health })),
);
const HealthDetail = lazy(() =>
  import("./pages/HealthDetail").then((m) => ({ default: m.HealthDetail })),
);
const Diagnostics = lazy(() =>
  import("./pages/Diagnostics").then((m) => ({ default: m.Diagnostics })),
);
const RestockWatches = lazy(() =>
  import("./pages/RestockWatches").then((m) => ({ default: m.RestockWatches })),
);
const DistributorAnalysis = lazy(() =>
  import("./pages/DistributorAnalysis").then((m) => ({
    default: m.DistributorAnalysis,
  })),
);
const SharedWatchlist = lazy(() =>
  import("./pages/SharedWatchlist").then((m) => ({ default: m.SharedWatchlist })),
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);
const OAuthCallback = lazy(() =>
  import("./pages/OAuthCallback").then((m) => ({ default: m.OAuthCallback })),
);

// Discovery does a raw fetch (the tRPC client can't wrap its abort/timeout
// needs), so register the API headers it must carry — auth + BYO-LLM.
setDiscoveryHeadersProvider(trpcHeaders);

export default function App() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { open: onboardingOpen, complete: completeOnboarding } = useOnboardingModal();
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
  const { isAuthenticated } = useAuth();
  const { trpcClient } = useAppBootstrap({ isAuthenticated });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <NotificationRouter />
          <KeyboardShortcuts
            setSearchModalOpen={setSearchModalOpen}
            setShortcutsOpen={setShortcutsOpen}
          />
          <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
          <OnboardingModal open={onboardingOpen} onClose={completeOnboarding} />
          <SearchModal
            open={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
          />
          <ConfirmHost />
          <div className="flex h-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-900/20">
              <div className="min-h-full flex flex-col">
                <HeaderBar />
                <div className="flex-1 w-full max-w-6xl mx-auto">
                  <Suspense
                    fallback={
                      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
                        Loading...
                      </div>
                    }
                  >
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/watchlist" element={<Watchlist />} />
                      <Route path="/product/:id" element={<ProductDetail />} />
                      <Route path="/compare/:id" element={<Compare />} />
                      <Route path="/alerts" element={<Alerts />} />
                      <Route path="/drops" element={<Drops />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/rates" element={<Rates />} />
                      <Route path="/stats" element={<Stats />} />
                      <Route path="/health" element={<Health />} />
                      <Route path="/health/:id" element={<HealthDetail />} />
                      <Route path="/diagnostics" element={<Diagnostics />} />
                      <Route path="/restock-watches" element={<RestockWatches />} />
                      <Route
                        path="/distributor-analysis"
                        element={<DistributorAnalysis />}
                      />
                      <Route path="/w/:token" element={<SharedWatchlist />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/oauth/callback" element={<OAuthCallback />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </div>
              </div>
            </main>
          </div>
        </HashRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
