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

export function resetDialogStackForTests(): void {
  stack.length = 0;
}
