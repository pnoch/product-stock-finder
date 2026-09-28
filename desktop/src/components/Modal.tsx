import { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
import {
  isTopDialog,
  lockBodyScroll,
  popDialog,
  pushDialog,
  unlockBodyScroll,
} from "../lib/dialog-stack";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const tokenRef = useRef<symbol | null>(null);
  if (tokenRef.current === null) {
    tokenRef.current = Symbol("modal");
  }

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    // focus first focusable element
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0] ?? dialog;
      // use rAF to ensure dialog is rendered
      requestAnimationFrame(() => (first as HTMLElement).focus());
    }
    return () => {
      unlockBodyScroll();
      // restore focus
      if (previousActiveRef.current) {
        previousActiveRef.current.focus();
        previousActiveRef.current = null;
      }
    };
  }, [open]);

  // Call sites pass an inline `onClose`, so using it as an effect dependency
  // re-ran this on every parent render — re-adding the keydown listener and
  // re-pushing the dialog token each time (corrupting the dialog stack). Keep
  // the handler in a ref and key the effect on `open` only.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const id = tokenRef.current as symbol;
    pushDialog(id);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopDialog(id)) {
        onCloseRef.current();
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      popDialog(id);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden animate-scaleIn outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">{children}</div>
      </div>
    </div>
  );
}
