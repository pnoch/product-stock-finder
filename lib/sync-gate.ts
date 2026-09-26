// A monotonic token for the current signed-in "session" of the local store.
//
// `clearAccountData` bumps it when it wipes the store on logout. A sync that
// started under an older token must not write its pulled rows or its cursor
// back afterwards: doing so resurrects the previous account's data (and its
// `sync_meta`, which makes the next account's first sync incremental and skip
// items) — the cross-account leak the logout wipe exists to prevent.
//
// Lives in its own module so `lib/storage` can bump it without importing the
// sync engine (which imports storage).
let generation = 0;

export function currentSyncGeneration(): number {
  return generation;
}

export function bumpSyncGeneration(): void {
  generation += 1;
}
