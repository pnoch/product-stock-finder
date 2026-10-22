import { CheckCircle, Tag as TagIcon, Trash2 } from "lucide-react";
import type { Product } from "../../../../lib/types";

export function WatchlistRowActions({
  product,
  acquired,
  onToggleAcquired,
  onEditTags,
  onRemove,
}: {
  product: Product;
  acquired: boolean;
  onToggleAcquired: (e: React.MouseEvent, product: Product) => void;
  onEditTags: (product: Product) => void;
  onRemove: (e: React.MouseEvent, productId: string) => void;
}) {
  return (
    <td className="px-4 py-3 text-right">
      <button
        type="button"
        onClick={(e) => void onToggleAcquired(e, product)}
        onKeyDown={(e) => e.stopPropagation()}
        className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          acquired
            ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30"
        }`}
        aria-label={acquired ? "Mark as not acquired" : "Mark as acquired"}
        aria-pressed={acquired}
      >
        <CheckCircle className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEditTags(product);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={`Edit tags for ${product.name}`}
      >
        <TagIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={(e) => onRemove(e, product.id)}
        onKeyDown={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        aria-label={`Remove ${product.name} from watchlist`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </td>
  );
}
