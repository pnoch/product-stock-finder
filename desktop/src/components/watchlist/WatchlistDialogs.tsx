import type { Product, TagDefinition } from "../../../../lib/types";
import { ManageTagsDialog } from "./ManageTagsDialog";
import { BulkTagDialog } from "./BulkTagDialog";
import { ProductTagPickerDialog } from "./ProductTagPickerDialog";

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
  onToggleBulkTag: (tagId: string) => void;
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
      <ManageTagsDialog
        open={manageOpen}
        onClose={onCloseManage}
        tagDefinitions={tagDefinitions}
        error={manageError}
        editingTagId={editingTagId}
        editingTagName={editingTagName}
        onEditingTagNameChange={onEditingTagNameChange}
        editingTagColor={editingTagColor}
        onEditingTagColorChange={onEditingTagColorChange}
        onEditTag={onEditTag}
        onCancelEditTag={onCancelEditTag}
        onUpdateTag={onUpdateTag}
        onDeleteTag={onDeleteTag}
        onRecolorTag={onRecolorTag}
        newTagName={newTagName}
        onNewTagNameChange={onNewTagNameChange}
        newTagColor={newTagColor}
        onNewTagColorChange={onNewTagColorChange}
        onCreateTag={onCreateTag}
      />
      <BulkTagDialog
        open={bulkOpen}
        onClose={onCloseBulk}
        selectedCount={selectedIds.size}
        error={bulkError}
        tagDefinitions={tagDefinitions}
        selectedTagIds={bulkSelectedTagIds}
        onToggleTag={onToggleBulkTag}
        newTagName={bulkNewTagName}
        onNewTagNameChange={onBulkNewTagNameChange}
        newTagColor={bulkNewTagColor}
        onNewTagColorChange={onBulkNewTagColorChange}
        onCreateTag={onBulkCreateTag}
        onApply={onBulkApply}
      />
      <ProductTagPickerDialog
        product={tagPickerProduct}
        onClose={onCloseTagPicker}
        tagDefinitions={tagDefinitions}
        onToggleTag={onToggleProductTag}
      />
    </>
  );
}
