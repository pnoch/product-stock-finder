import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "../../hooks/use-theme";
import { useToast } from "../../hooks/use-toast";
import { exportWatchlistAsJson } from "../../import-export";

export function KeyboardShortcuts({
  setSearchModalOpen,
  setShortcutsOpen,
}: {
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const { toggle } = useTheme();
  const { toast, showToast } = useToast();

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
        exportWatchlistAsJson().catch(() => showToast("Export failed"));
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
  }, [setSearchModalOpen, setShortcutsOpen, navigate, toggle, showToast]);

  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60] animate-fadeIn">
      {toast}
    </div>
  );
}
