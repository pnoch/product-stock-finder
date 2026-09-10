import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "product_notes";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

async function readAll(store: KeyValueStore): Promise<Record<string, string>> {
  try {
    const raw = await store.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export async function getProductNote(
  productId: string,
  store: KeyValueStore = AsyncStorage,
): Promise<string> {
  const all = await readAll(store);
  return all[productId] ?? "";
}

// Best-effort serialization of read-modify-write cycles so concurrent saves
// cannot clobber each other. lib/storage's per-key enqueue does not fit here
// (callers inject their own KeyValueStore), so chain module-locally. The chain
// itself never stays rejected; callers still observe their own write's error.
let pending: Promise<unknown> = Promise.resolve();

export async function saveProductNote(
  productId: string,
  note: string,
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  const doWrite = async (): Promise<void> => {
    const all = await readAll(store);
    const trimmed = note.trim();
    if (!trimmed) delete all[productId];
    else all[productId] = trimmed;
    await store.setItem(KEY, JSON.stringify(all));
  };
  const next = pending.then(doWrite, doWrite);
  pending = next.catch(() => {});
  return next;
}
