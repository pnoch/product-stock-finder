import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router";
import { Sidebar } from "./components/Sidebar";
import { SearchModal } from "./components/SearchModal";
import { Home } from "./pages/Home";
import { Watchlist } from "./pages/Watchlist";
import { ProductDetail } from "./pages/ProductDetail";
import { Compare } from "./pages/Compare";
import { Alerts } from "./pages/Alerts";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { exportWatchlistAsJson } from "./import-export";
import { useTheme } from "./hooks/use-theme";

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

  return (
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
