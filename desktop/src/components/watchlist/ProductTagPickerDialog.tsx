import { X } from "lucide-react";
import type { Product, TagDefinition } from "../../../../lib/types";
import { DialogOverlay } from "../DialogOverlay";

export function ProductTagPickerDialog({
  product,
  onClose,
  tagDefinitions,
  onToggleTag,
}: {
  product: Product | null;
  onClose: () => void;
  tagDefinitions: Record<string, TagDefinition>;
  onToggleTag: (tagId: string) => void;
}) {
  if (!product) return null;
  return (
    <DialogOverlay open onClose={onClose} label="Assign tags">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Assign tags</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {Object.keys(tagDefinitions).length === 0 ? (
          <p className="text-sm text-gray-500">
            No tags yet — create one in Manage Tags.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {Object.values(tagDefinitions).map((def) => {
              const sel = (product.tags ?? []).includes(def.id);
              return (
                <label
                  key={def.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => onToggleTag(def.id)}
                    aria-label={`Toggle ${def.name}`}
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: def.color }}
                  />
                  <span className="text-sm">{def.name}</span>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
