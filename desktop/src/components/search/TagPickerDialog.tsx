import { X } from "lucide-react";
import type { TagDefinition } from "../../../../lib/types";
import { DialogOverlay } from "../DialogOverlay";

export function TagPickerDialog({
  open,
  productId,
  tagDefinitions,
  pendingTags,
  newTagName,
  onNewTagName,
  onToggleTag,
  onCreateTag,
  onClear,
  onClose,
}: {
  open: boolean;
  productId: string | null;
  tagDefinitions: Record<string, TagDefinition>;
  pendingTags: Record<string, string[]>;
  newTagName: string;
  onNewTagName: (name: string) => void;
  onToggleTag: (tagId: string) => void;
  onCreateTag: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  if (!open || !productId) return null;
  const selected = pendingTags[productId] ?? [];
  return (
    <DialogOverlay open onClose={onClose} label="Assign tags">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm">Assign tags</h3><button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button></div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {Object.values(tagDefinitions).map((def) => {
            const sel = selected.includes(def.id);
            return <label key={def.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"><input type="checkbox" checked={sel} onChange={() => onToggleTag(def.id)} /><span className="w-3 h-3 rounded-full" style={{ backgroundColor: def.color }} /><span className="text-sm">{def.name}</span></label>;
          })}
          {Object.keys(tagDefinitions).length === 0 && <p className="text-sm text-gray-500">No tags yet — create one below.</p>}
        </div>
        <div className="mt-3">
          <input
            value={newTagName}
            onChange={(e) => onNewTagName(e.target.value)}
            maxLength={24}
            placeholder="New tag name"
            aria-label="New tag name"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
          <button
            onClick={onCreateTag}
            disabled={!newTagName.trim()}
            aria-label="Create tag"
            className="mt-2 w-full px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50"
          >
            Create tag
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-3 py-1.5 rounded-lg border text-sm">Done</button><button onClick={onClear} className="px-3 py-1.5 text-sm text-gray-500">Clear</button></div>
      </div>
    </DialogOverlay>
  );
}
