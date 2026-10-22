import { Upload } from "lucide-react";
import { DialogOverlay } from "../DialogOverlay";

export function BulkImportDialog({
  open,
  text,
  onTextChange,
  matchedCount,
  unmatched,
  newCount,
  importing,
  onImport,
  onClose,
}: {
  open: boolean;
  text: string;
  onTextChange: (text: string) => void;
  matchedCount: number;
  unmatched: string[];
  newCount: number;
  importing: boolean;
  onImport: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <DialogOverlay open onClose={onClose} label="Import List">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Upload className="w-4 h-4" /> Import List</h3>
        <p className="text-xs text-gray-500 mb-2">Paste model numbers (e.g. CRS326-24S) — one per line or comma-separated.</p>
        <textarea value={text} onChange={(e) => onTextChange(e.target.value)} rows={6} placeholder="CRS804-4DDQ-hRM\nCCR2216-1G-12XS-2XQ" className="w-full p-3 rounded-lg border text-sm mb-3" />
        {text.trim() && (
          <div className="mb-3 space-y-1">
            <p className="text-xs font-semibold">{matchedCount} matched · {unmatched.length} not found · {newCount} new{matchedCount - newCount > 0 ? ` · ${matchedCount - newCount} already tracked` : ""}</p>
            {unmatched.slice(0, 5).map((m) => <p key={m} className="text-xs text-red-600">Not found: {m}</p>)}
            {unmatched.length > 5 && <p className="text-xs text-gray-500">+{unmatched.length - 5} more not found</p>}
            {matchedCount - newCount > 0 && <p className="text-xs text-gray-500">{matchedCount - newCount} already in watchlist</p>}
          </div>
        )}
        <div className="flex justify-end gap-2"><button onClick={onClose} className="px-3 py-2 rounded-lg border text-sm">Cancel</button><button onClick={onImport} disabled={newCount === 0 || importing} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50">{importing ? "Importing…" : `Import ${newCount}`}</button></div>
      </div>
    </DialogOverlay>
  );
}
