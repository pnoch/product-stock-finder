import { useEffect, useRef } from "react";
import {
  isTopDialog,
  lockBodyScroll,
  popDialog,
  pushDialog,
  unlockBodyScroll,
} from "../lib/dialog-stack";

/**
 * Backdrop + accessible container for the dialog panels that are too custom for
 * the shared `Modal` (variable size, custom footer, scrolling body). Provides
 * Escape-to-close, focus-on-open, focus restore, a Tab trap, and
 * `role="dialog"`/`aria-modal`. Before this the hand-rolled overlays were
 * keyboard-inaccessible: Escape did nothing and focus never entered the panel.
 */
export function DialogOverlay({
  open,
  onClose,
  label,
  className = "fixed inset-0 z-50 flex items-center justify-center bg-black/40",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const tokenRef = useRef<symbol | null>(null);
  if (tokenRef.current === null) tokenRef.current = Symbol("dialog");

  // Call sites pass an inline `onClose`, so using it as an effect dependency
  // re-ran the focus/scroll-lock effect on every parent render — each keystroke
  // restored focus outside the dialog and then focused its first element, so
  // typing in a later field jumped after one character. Keep the handler in a
  // ref and key the effect on `open` only.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const token = tokenRef.current as symbol;
    pushDialog(token);
    lockBodyScroll();
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    const overlay = overlayRef.current;
    if (overlay) {
      const focusable = overlay.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      requestAnimationFrame(() => (focusable[0] ?? overlay).focus());
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopDialog(token)) {
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const el = overlayRef.current;
        if (!el) return;
        const focusable = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (n) =>
            !n.hasAttribute("disabled") &&
            n.getAttribute("aria-hidden") !== "true",
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      popDialog(token);
      unlockBodyScroll();
      if (previousActiveRef.current) {
        previousActiveRef.current.focus();
        previousActiveRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {children}
    </div>
  );
}
