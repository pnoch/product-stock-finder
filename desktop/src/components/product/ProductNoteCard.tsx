export function ProductNoteCard({
  note,
  draftNote,
  onDraftChange,
  editingNote,
  onStartEdit,
  onCancel,
  onSave,
  error,
}: {
  note: string;
  draftNote: string;
  onDraftChange: (value: string) => void;
  editingNote: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  error: string | null;
}) {
  return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">My Note</h2>
          {!editingNote && (
            <button
              onClick={onStartEdit}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Edit note"
            >
              Edit
            </button>
          )}
        </div>
        {error && <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{error}</p>}
        {editingNote ? (
          <div className="space-y-2">
            <textarea
              value={draftNote}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Private note (only visible on this device)…"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product note"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Cancel editing note"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                aria-label="Save note"
              >
                Save
              </button>
            </div>
          </div>
        ) : note ? (
          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{note}</p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Add a private note…</p>
        )}
      </div>

  );
}
