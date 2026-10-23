import { useSyncExternalStore } from "react";
import { DialogOverlay } from "../DialogOverlay";
import {
  getConfirmRequest,
  resolveConfirm,
  subscribeConfirm,
} from "../../lib/confirm";

export function ConfirmHost() {
  const request = useSyncExternalStore(
    subscribeConfirm,
    getConfirmRequest,
    getConfirmRequest,
  );
  if (!request) return null;
  return (
    <DialogOverlay
      open
      onClose={() => resolveConfirm(false)}
      label={request.title}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold">{request.title}</h3>
        {request.message && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {request.message}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => resolveConfirm(false)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => resolveConfirm(true)}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
              request.destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
