import { useState } from "react";
import type { Product } from "../../../lib/types";
import { storage } from "../storage";

export function useProductEdit(
  product: Product | null,
  loadProduct: () => Promise<void>,
  showToast: (message: string) => void,
) {
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = () => {
    if (!product) return;
    setEditName(product.name);
    setEditModel(product.modelNumber);
    setEditBrand(product.brand);
    setEditCategory(product.category);
    setEditDescription(product.description ?? "");
    setEditError(null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!product) return;
    // Require both name and model, like mobile's canSave: updateProductDetails
    // only applies a trimmed non-empty model, so saving a blank model silently
    // kept the old one while the UI implied it changed.
    if (!editName.trim() || !editModel.trim()) return;
    setEditError(null);
    try {
      await storage.updateProductDetails(product.id, {
        name: editName.trim(),
        modelNumber: editModel.trim(),
        brand: editBrand.trim(),
        category: editCategory.trim(),
        description: editDescription.trim(),
      });
      setEditOpen(false);
      await loadProduct();
      showToast("Product updated");
    } catch {
      setEditError("Couldn't save changes");
      showToast("Couldn't save changes");
    }
  };

  return {
    editOpen,
    editName,
    setEditName,
    editModel,
    setEditModel,
    editBrand,
    setEditBrand,
    editCategory,
    setEditCategory,
    editDescription,
    setEditDescription,
    editError,
    openEdit,
    closeEdit,
    handleSaveEdit,
  };
}
