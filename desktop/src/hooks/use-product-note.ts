import { useEffect, useState } from "react";
import type { Product } from "../../../lib/types";
import { notesStore } from "../lib/product-detail";
import { getProductNote, saveProductNote } from "../../../lib/product-notes";

export function useProductNote(
  product: Product | null,
  showToast: (message: string) => void,
) {
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    getProductNote(product.id, notesStore)
      .then((value) => {
        if (!cancelled) setNote(value);
      })
      .catch(() => {
        if (!cancelled) setNoteError("Couldn't load note");
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  const startEditNote = () => {
    setDraftNote(note);
    setNoteError(null);
    setEditingNote(true);
  };

  const cancelEditNote = () => {
    setDraftNote(note);
    setNoteError(null);
    setEditingNote(false);
  };

  const handleSaveNote = async () => {
    if (!product) return;
    try {
      await saveProductNote(product.id, draftNote.trim(), notesStore);
      setNote(draftNote.trim());
      setEditingNote(false);
      setNoteError(null);
      showToast("Note saved");
    } catch {
      setNoteError("Couldn't save note");
      showToast("Couldn't save note");
    }
  };

  return {
    note,
    draftNote,
    setDraftNote,
    editingNote,
    noteError,
    startEditNote,
    cancelEditNote,
    handleSaveNote,
  };
}
