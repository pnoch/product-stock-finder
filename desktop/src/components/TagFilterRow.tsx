import type { TagDefinition } from "../../../lib/types";

interface Props {
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  counts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeMode: (mode: "any" | "all") => void;
  onClearAll: () => void;
}

export function TagFilterRow({
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  counts,
  onToggleTag,
  onChangeMode,
  onClearAll,
}: Props) {
  const tags = Object.values(tagDefinitions);
  if (tags.length === 0) return null;
  const hasSelection = selectedTagIds.length > 0;
  const showMode = selectedTagIds.length >= 2;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex-1 flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => onToggleTag(tag.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              aria-label={`${active ? "Deselect" : "Select"} tag ${tag.name}`}
              aria-pressed={active}
              title={tag.name}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: active ? "#fff" : tag.color }}
              />
              {tag.name} · {counts[tag.id] ?? 0}
            </button>
          );
        })}
      </div>
      {showMode && (
        <div className="flex rounded-full border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
          {(["any", "all"] as const).map((mode) => {
            const active = tagMatchMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onChangeMode(mode)}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                aria-label={`${mode === "any" ? "Any" : "All"} match mode`}
                aria-pressed={active}
              >
                {mode === "any" ? "Any" : "All"}
              </button>
            );
          })}
        </div>
      )}
      {hasSelection && (
        <button
          onClick={onClearAll}
          className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0"
          aria-label="Clear tag filter"
        >
          Clear
        </button>
      )}
    </div>
  );
}
