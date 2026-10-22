import { Tag as TagIcon, X } from "lucide-react";
import { TAG_PALETTE } from "../../../../lib/tags";
import type { Product, TagDefinition } from "../../../../lib/types";
import { DialogOverlay } from "../DialogOverlay";

export function WatchlistDialogs({
  manageOpen,
  onCloseManage,
  tagDefinitions,
  manageError,
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
  bulkOpen,
  onCloseBulk,
  selectedIds,
  bulkError,
  bulkSelectedTagIds,
  onToggleBulkTag,
  bulkNewTagName,
  onBulkNewTagNameChange,
  bulkNewTagColor,
  onBulkNewTagColorChange,
  onBulkCreateTag,
  onBulkApply,
  tagPickerProduct,
  onCloseTagPicker,
  onToggleProductTag,
}: {
  manageOpen: boolean;
  onCloseManage: () => void;
  tagDefinitions: Record<string, TagDefinition>;
  manageError: string | null;
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
  bulkOpen: boolean;
  onCloseBulk: () => void;
  selectedIds: Set<string>;
  bulkError: string | null;
  bulkSelectedTagIds: string[];
  onToggleBulkTag: (id: string) => void;
  bulkNewTagName: string;
  onBulkNewTagNameChange: (value: string) => void;
  bulkNewTagColor: string;
  onBulkNewTagColorChange: (value: string) => void;
  onBulkCreateTag: () => void;
  onBulkApply: () => void;
  tagPickerProduct: Product | null;
  onCloseTagPicker: () => void;
  onToggleProductTag: (tagId: string) => void;
}) {
  return (
    <>
      <DialogOverlay
        open={manageOpen}
        onClose={onCloseManage}
        label="Manage Tags"
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TagIcon className="w-4 h-4" /> Manage Tags
            </h3>
            <button
              onClick={onCloseManage}
              aria-label="Close"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {manageError && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-3">
              {manageError}
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
              onClick={onCloseManage}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </DialogOverlay>

      <DialogOverlay open={bulkOpen} onClose={onCloseBulk} label="Add Tags">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold flex items-center gap-2">
              <TagIcon className="w-4 h-4" /> Add Tags
            </h3>
            <button
              onClick={onCloseBulk}
              aria-label="Close"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Apply to {selectedIds.size} product
            {selectedIds.size !== 1 ? "s" : ""}
          </p>
          {bulkError && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-2">
              {bulkError}
            </p>
          )}
          <div className="space-y-1 mb-4 max-h-[260px] overflow-y-auto">
            {Object.keys(tagDefinitions).length === 0 && (
              <p className="text-sm text-gray-500">
                No tags yet — create one below.
              </p>
            )}
            {Object.values(tagDefinitions).map((tag) => {
              const active = bulkSelectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => onToggleBulkTag(tag.id)}
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
                value={bulkNewTagColor}
                onChange={(e) => onBulkNewTagColorChange(e.target.value)}
                className="w-8 h-8 rounded border shrink-0"
                aria-label="New tag color"
              />
              <input
                value={bulkNewTagName}
                maxLength={24}
                onChange={(e) => onBulkNewTagNameChange(e.target.value)}
                placeholder="New tag name"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
              <button
                onClick={onBulkCreateTag}
                disabled={!bulkNewTagName.trim()}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium disabled:opacity-50"
              >
                Create
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TAG_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => onBulkNewTagColorChange(c)}
                  className={`w-5 h-5 rounded-full border-2 ${
                    bulkNewTagColor === c
                      ? "border-gray-900 dark:border-white"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Pick ${c}`}
                />
              ))}
            </div>
            <button
              onClick={onBulkApply}
              disabled={bulkSelectedTagIds.length === 0}
              className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              Add{" "}
              {bulkSelectedTagIds.length > 0
                ? `${bulkSelectedTagIds.length} tag${
                    bulkSelectedTagIds.length !== 1 ? "s" : ""
                  } `
                : ""}
              to selected
            </button>
          </div>
          <div className="flex justify-center mt-3">
            <button
              onClick={onCloseBulk}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogOverlay>

      {tagPickerProduct && (
        <DialogOverlay
          open
          onClose={onCloseTagPicker}
          label="Assign tags"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Assign tags</h3>
              <button
                onClick={onCloseTagPicker}
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
                  const sel = (tagPickerProduct.tags ?? []).includes(def.id);
                  return (
                    <label
                      key={def.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => onToggleProductTag(def.id)}
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
                onClick={onCloseTagPicker}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </>
  );
}
