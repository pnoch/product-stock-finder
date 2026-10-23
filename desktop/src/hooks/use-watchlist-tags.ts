import { useEffect, useState } from "react";
import { log } from "@shared/log";
import { TAG_PALETTE, nextTagColor } from "../../../lib/tags";
import type { Product, TagDefinition } from "../../../lib/types";
import { storage } from "../storage";
import { confirmAction } from "../lib/confirm";

type Options = {
  settings: { tagDefinitions?: Record<string, TagDefinition> } | null;
  tagDefinitions: Record<string, TagDefinition>;
  setTagDefinitions: React.Dispatch<
    React.SetStateAction<Record<string, TagDefinition>>
  >;
  setSelectedTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedIds: Set<string>;
  exitSelection: () => void;
  refresh: () => Promise<void>;
  showToast: (message: string) => void;
};

export function useWatchlistTags({
  settings,
  tagDefinitions,
  setTagDefinitions,
  setSelectedTagIds,
  selectedIds,
  exitSelection,
  refresh,
  showToast,
}: Options) {
  const [manageOpen, setManageOpen] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [editingTagColor, setEditingTagColor] = useState(TAG_PALETTE[0]);
  const [manageError, setManageError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelectedTagIds, setBulkSelectedTagIds] = useState<string[]>([]);
  const [bulkNewTagName, setBulkNewTagName] = useState("");
  const [bulkNewTagColor, setBulkNewTagColor] = useState(TAG_PALETTE[0]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [tagPickerProduct, setTagPickerProduct] = useState<Product | null>(
    null,
  );

  useEffect(() => {
    storage
      .getSettings()
      .then((s) => {
        const defs = (s.tagDefinitions ?? {}) as Record<string, TagDefinition>;
        setTagDefinitions(defs);
        setSelectedTagIds((prev) =>
          prev.filter((id) => Object.prototype.hasOwnProperty.call(defs, id)),
        );
      })
      .catch(() => {});
  }, [settings, setTagDefinitions, setSelectedTagIds]);

  const refreshTagDefs = async () => {
    const defs = await storage.getTagDefinitions();
    setTagDefinitions(defs as Record<string, TagDefinition>);
    setSelectedTagIds((prev) =>
      prev.filter((id) => Object.prototype.hasOwnProperty.call(defs, id)),
    );
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setManageError(null);
    try {
      await storage.createTag(name, newTagColor);
      await refreshTagDefs();
      setNewTagName("");
      setNewTagColor(nextTagColor(await storage.getTagDefinitions()));
      showToast(`Tag "${name}" created`);
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not create tag");
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTagId) return;
    const name = editingTagName.trim();
    if (!name) return;
    setManageError(null);
    try {
      await storage.renameTag(editingTagId, name);
      if (editingTagColor !== tagDefinitions[editingTagId]?.color) {
        await storage.setTagColor(editingTagId, editingTagColor);
      }
      await refreshTagDefs();
      setEditingTagId(null);
      showToast("Tag updated");
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not update tag");
    }
  };

  const handleRecolorTag = async (id: string, color: string) => {
    try {
      await storage.setTagColor(id, color);
      await refreshTagDefs();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not recolor tag");
    }
  };

  const handleDeleteTag = async (id: string) => {
    const def = tagDefinitions[id];
    if (!def) return;
    if (
      !(await confirmAction({
        title: `Delete "${def.name}"?`,
        message: "It will be removed from all products.",
        confirmLabel: "Delete",
        destructive: true,
      }))
    )
      return;
    setManageError(null);
    try {
      await storage.deleteTag(id);
      await refreshTagDefs();
      await refresh();
      showToast("Tag deleted");
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not delete tag");
    }
  };

  const toggleBulkTag = (tagId: string) => {
    setBulkSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((i) => i !== tagId)
        : [...prev, tagId],
    );
  };

  const handleBulkCreateTag = async () => {
    const name = bulkNewTagName.trim();
    if (!name) return;
    setBulkError(null);
    try {
      const current = await storage.getTagDefinitions();
      const tag = await storage.createTag(name, bulkNewTagColor);
      setTagDefinitions((prev) => ({ ...prev, [tag.id]: tag }));
      setBulkSelectedTagIds((prev) => [...prev, tag.id]);
      setBulkNewTagName("");
      setBulkNewTagColor(nextTagColor({ ...current, [tag.id]: tag }));
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Could not create tag");
    }
  };

  const handleBulkApply = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || bulkSelectedTagIds.length === 0) return;
    setBulkError(null);
    try {
      await storage.addTagsToProducts(ids, bulkSelectedTagIds);
      await refresh();
      await refreshTagDefs();
      setBulkOpen(false);
      setBulkSelectedTagIds([]);
      exitSelection();
      showToast(
        `Added ${bulkSelectedTagIds.length} tag${
          bulkSelectedTagIds.length !== 1 ? "s" : ""
        } to ${ids.length} product${ids.length !== 1 ? "s" : ""}`,
      );
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Could not apply tags");
    }
  };

  const openBulkTagSheet = async () => {
    try {
      const defs = await storage.getTagDefinitions();
      setTagDefinitions(defs as Record<string, TagDefinition>);
    } catch {
      log.error("[Watchlist] Failed to load tag definitions");
      showToast("Couldn't load tags");
    }
    setBulkSelectedTagIds([]);
    setBulkNewTagName("");
    setBulkError(null);
    setBulkNewTagColor(nextTagColor(tagDefinitions));
    setBulkOpen(true);
  };

  const handleToggleProductTag = async (tagId: string) => {
    if (!tagPickerProduct) return;
    const current = tagPickerProduct.tags ?? [];
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    try {
      await storage.setProductTags(tagPickerProduct.id, next);
      setTagPickerProduct((p) => (p ? { ...p, tags: next } : p));
      await refresh();
    } catch {
      showToast("Couldn't update tags");
    }
  };

  return {
    tagDefinitions,
    setTagDefinitions,
    manageOpen,
    setManageOpen,
    editingTagId,
    setEditingTagId,
    editingTagName,
    setEditingTagName,
    editingTagColor,
    setEditingTagColor,
    manageError,
    setManageError,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    bulkOpen,
    setBulkOpen,
    bulkSelectedTagIds,
    setBulkSelectedTagIds,
    bulkNewTagName,
    setBulkNewTagName,
    bulkNewTagColor,
    setBulkNewTagColor,
    bulkError,
    setBulkError,
    tagPickerProduct,
    setTagPickerProduct,
    refreshTagDefs,
    handleCreateTag,
    handleUpdateTag,
    handleRecolorTag,
    handleDeleteTag,
    toggleBulkTag,
    handleBulkCreateTag,
    handleBulkApply,
    openBulkTagSheet,
    handleToggleProductTag,
  };
}
