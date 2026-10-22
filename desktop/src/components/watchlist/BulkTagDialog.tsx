import { Tag as TagIcon, X } from "lucide-react";
import { TAG_PALETTE } from "../../../../lib/tags";
import type { TagDefinition } from "../../../../lib/types";
import { DialogOverlay } from "../DialogOverlay";

export function BulkTagDialog({
  open,
  onClose,
  selectedCount,
  error,
  tagDefinitions,
  selectedTagIds,
  onToggleTag,
  newTagName,
  onNewTagNameChange,
  newTagColor,
  onNewTagColorChange,
  onCreateTag,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  error: string | null;
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  newTagName: string;
  onNewTagNameChange: (value: string) => void;
  newTagColor: string;
  onNewTagColorChange: (value: string) => void;
  onCreateTag: () => void;
  onApply: () => void;
}) {
  return (
    <DialogOverlay open={open} onClose={onClose} label="Add Tags">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold flex items-center gap-2">
            <TagIcon className="w-4 h-4" /> Add Tags
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Apply to {selectedCount} product
          {selectedCount !== 1 ? "s" : ""}
        </p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">
            {error}
          </p>
        )}
        <div className="space-y-1 mb-4 max-h-[260px] overflow-y-auto">
          {Object.keys(tagDefinitions).length === 0 && (
            <p className="text-sm text-gray-500">
              No tags yet — create one below.
            </p>
          )}
          {Object.values(tagDefinitions).map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => onToggleTag(tag.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left ${
                  active
                    ? "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800"
                    : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    active
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  }`}
                >
                  {active ? "✓" : ""}
                </span>
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm font-medium truncate">
                  {tag.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => onNewTagColorChange(e.target.value)}
              className="w-8 h-8 rounded border shrink-0"
              aria-label="New tag color"
            />
            <input
              value={newTagName}
              maxLength={24}
              onChange={(e) => onNewTagNameChange(e.target.value)}
              placeholder="New tag name"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
            <button
              onClick={onCreateTag}
              disabled={!newTagName.trim()}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium disabled:opacity-50"
            >
              Create
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TAG_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => onNewTagColorChange(c)}
                className={`w-5 h-5 rounded-full border-2 ${
                  newTagColor === c
                    ? "border-gray-900 dark:border-white"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Pick ${c}`}
              />
            ))}
          </div>
          <button
            onClick={onApply}
            disabled={selectedTagIds.length === 0}
            className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            Add{" "}
            {selectedTagIds.length > 0
              ? `${selectedTagIds.length} tag${
                  selectedTagIds.length !== 1 ? "s" : ""
                } `
              : ""}
            to selected
          </button>
        </div>
        <div className="flex justify-center mt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
