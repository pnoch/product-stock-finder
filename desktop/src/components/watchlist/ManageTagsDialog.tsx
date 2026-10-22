import { Tag as TagIcon, X } from "lucide-react";
import { TAG_PALETTE } from "../../../../lib/tags";
import type { TagDefinition } from "../../../../lib/types";
import { DialogOverlay } from "../DialogOverlay";

export function ManageTagsDialog({
  open,
  onClose,
  tagDefinitions,
  error,
  editingTagId,
  editingTagName,
  onEditingTagNameChange,
  editingTagColor,
  onEditingTagColorChange,
  onEditTag,
  onCancelEditTag,
  onUpdateTag,
  onDeleteTag,
  onRecolorTag,
  newTagName,
  onNewTagNameChange,
  newTagColor,
  onNewTagColorChange,
  onCreateTag,
}: {
  open: boolean;
  onClose: () => void;
  tagDefinitions: Record<string, TagDefinition>;
  error: string | null;
  editingTagId: string | null;
  editingTagName: string;
  onEditingTagNameChange: (value: string) => void;
  editingTagColor: string;
  onEditingTagColorChange: (value: string) => void;
  onEditTag: (def: TagDefinition) => void;
  onCancelEditTag: () => void;
  onUpdateTag: () => void;
  onDeleteTag: (id: string) => void;
  onRecolorTag: (id: string, color: string) => void;
  newTagName: string;
  onNewTagNameChange: (value: string) => void;
  newTagColor: string;
  onNewTagColorChange: (value: string) => void;
  onCreateTag: () => void;
}) {
  return (
    <DialogOverlay open={open} onClose={onClose} label="Manage Tags">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TagIcon className="w-4 h-4" /> Manage Tags
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-3">
            {error}
          </p>
        )}
        <div className="space-y-3 mb-4 max-h-[360px] overflow-y-auto pr-1">
          {Object.values(tagDefinitions).map((def) => (
            <div
              key={def.id}
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {editingTagId === def.id ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={editingTagColor}
                    onChange={(e) => onEditingTagColorChange(e.target.value)}
                    className="w-8 h-8 rounded border shrink-0"
                    aria-label="Tag color"
                  />
                  <input
                    value={editingTagName}
                    maxLength={24}
                    onChange={(e) => onEditingTagNameChange(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    placeholder="Tag name"
                  />
                  <button
                    onClick={onUpdateTag}
                    className="px-2.5 py-1 rounded bg-brand-600 text-white text-xs font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEditTag}
                    className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: def.color }}
                  />
                  <span className="flex-1 text-sm font-medium truncate">
                    {def.name}
                  </span>
                  <button
                    onClick={() => onEditTag(def)}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteTag(def.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {TAG_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      if (editingTagId === def.id)
                        onEditingTagColorChange(color);
                      else onRecolorTag(def.id, color);
                    }}
                    className={`w-6 h-6 rounded-full border-2 ${
                      (editingTagId === def.id
                        ? editingTagColor
                        : def.color) === color
                        ? "border-gray-900 dark:border-white"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Set color to ${color}`}
                  />
                ))}
              </div>
            </div>
          ))}
          {Object.keys(tagDefinitions).length === 0 && (
            <p className="text-sm text-gray-500">
              No tags yet. Create one below.
            </p>
          )}
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs font-semibold mb-2">Create new tag</p>
          <div className="flex items-center gap-2 mb-2">
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
              placeholder="Tag name"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
            <button
              onClick={onCreateTag}
              disabled={!newTagName.trim()}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TAG_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => onNewTagColorChange(c)}
                className={`w-6 h-6 rounded-full border-2 ${
                  newTagColor === c
                    ? "border-gray-900 dark:border-white"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Pick color ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
