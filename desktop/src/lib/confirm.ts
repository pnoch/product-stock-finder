export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

let current: ConfirmRequest | null = null;
let nextId = 1;
const subscribers = new Set<() => void>();

function emit(): void {
  for (const fn of subscribers) fn();
}

// Promise-based replacement for `window.confirm`: hooks can await it without
// rendering, and one <ConfirmHost /> in the app shell owns the dialog. Native
// confirm() blocks the renderer and cannot be styled or keyboard-trapped.
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    current = { ...options, id: nextId++, resolve };
    emit();
  });
}

export function getConfirmRequest(): ConfirmRequest | null {
  return current;
}

export function subscribeConfirm(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function resolveConfirm(value: boolean): void {
  const request = current;
  current = null;
  emit();
  request?.resolve(value);
}
