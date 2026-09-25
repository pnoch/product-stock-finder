// Shared LIFO stack of open dialogs. Both the shared `Modal` and `DialogOverlay`
// push a token here so Escape closes only the topmost dialog — including when a
// DialogOverlay (e.g. a tag picker) is layered over a Modal (e.g. SearchModal).
const stack: symbol[] = [];

export function pushDialog(token: symbol): void {
  stack.push(token);
}

export function popDialog(token: symbol): void {
  const idx = stack.lastIndexOf(token);
  if (idx !== -1) stack.splice(idx, 1);
}

export function isTopDialog(token: symbol): boolean {
  return stack[stack.length - 1] === token;
}

// Background scroll lock, ref-counted so nested dialogs don't unlock early (the
// first cleanup would otherwise restore scrolling while a dialog is still open).
let scrollLocks = 0;

export function lockBodyScroll(): void {
  scrollLocks += 1;
  if (typeof document !== "undefined") {
    document.body.style.overflow = "hidden";
  }
}

export function unlockBodyScroll(): void {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0 && typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
}

export function resetDialogStackForTests(): void {
  stack.length = 0;
  scrollLocks = 0;
}
