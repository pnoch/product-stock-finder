import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl";
  const shortcuts = [
    { keys: [mod, "K"], label: "Search products" },
    { keys: [mod, ","], label: "Open Settings" },
    { keys: [mod, "Shift", "T"], label: "Toggle theme" },
    { keys: [mod, "E"], label: "Export watchlist" },
    { keys: ["?"], label: "Show shortcuts" },
    { keys: ["Esc"], label: "Close dialog" },
  ];
  useEffect(() => {
    if (!open) return;
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
  if (!open) return null;
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
