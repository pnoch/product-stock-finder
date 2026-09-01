import { useEffect, useRef } from "react";
import { X } from "lucide-react";

let modalStack: number[] = [];
let modalIdCounter = 0;
let openModalCount = 0;

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
  const modalIdRef = useRef<number | null>(null);
  if (modalIdRef.current === null) {
    modalIdCounter += 1;
    modalIdRef.current = modalIdCounter;
  }

  useEffect(() => {
    if (!open) return;
    openModalCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = "";
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = modalIdRef.current as number;
    modalStack.push(id);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalStack[modalStack.length - 1] === id) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      const idx = modalStack.lastIndexOf(id);
      if (idx !== -1) modalStack.splice(idx, 1);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden animate-scaleIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{title}</h2>
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
