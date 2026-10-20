import { Modal } from "../Modal";

export function EditProductModal({
  open,
  onClose,
  name,
  onNameChange,
  model,
  onModelChange,
  brand,
  onBrandChange,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  error,
  originalName,
  originalModel,
  originalBrand,
  originalCategory,
  originalDescription,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  error: string | null;
  originalName: string;
  originalModel: string;
  originalBrand: string;
  originalCategory: string;
  originalDescription: string;
  onSave: () => void;
}) {
  return (
      <Modal
        open={open}
        onClose={onClose}
        title="Edit Product"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product model"
            />
            {model.trim() !== originalModel && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Model changed — listings will re-match on next refresh.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => onBrandChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product category"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Cancel editing product"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={
                !name.trim() ||
                !model.trim() ||
                (name.trim() === originalName &&
                  model.trim() === originalModel &&
                  brand.trim() === originalBrand &&
                  category.trim() === originalCategory &&
                  description.trim() === originalDescription)
              }
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
              aria-label="Save product changes"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

  );
}
