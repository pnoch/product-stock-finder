import { Tag as TagIcon } from "lucide-react";
import type { TagDefinition } from "../../../../lib/types";
import { TagFilterRow } from "../TagFilterRow";

export function WatchlistTagFilter({
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  tagCounts,
  onToggleTag,
  onChangeTagMode,
  onClearTags,
  onManageTags,
}: {
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  tagCounts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeTagMode: (mode: "any" | "all") => void;
  onClearTags: () => void;
  onManageTags: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <TagFilterRow
          tagDefinitions={tagDefinitions}
          selectedTagIds={selectedTagIds}
          tagMatchMode={tagMatchMode}
          counts={tagCounts}
          onToggleTag={onToggleTag}
          onChangeMode={onChangeTagMode}
          onClearAll={onClearTags}
        />
      </div>
      {Object.keys(tagDefinitions).length > 0 && (
        <button
          onClick={onManageTags}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
          aria-label="Manage tags"
        >
          <TagIcon className="w-3 h-3" /> Manage
        </button>
      )}
    </div>
  );
}
