import { useCallback, useEffect, useRef, useState } from "react";
import type { Storage } from "@/lib/storage";
import type { Collection } from "@/lib/types";

/**
 * Loads one storage collection and keeps it in sync with local mutations.
 *
 * The generation guard prevents an older read from overwriting a newer one
 * (focus + pull-to-refresh + a storage event can overlap). `loading` is the
 * first-load spinner only; later refreshes raise `refreshing`.
 */
export function useStorageCollection<T>(
  storage: Storage,
  collection: Collection,
  load: () => Promise<T>,
  initial: T,
) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedRef = useRef(false);
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (loadedRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await load();
      if (generation === generationRef.current) setData(next);
    } finally {
      if (generation === generationRef.current) {
        loadedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof storage.subscribeToStorageChanges !== "function") return;
    return storage.subscribeToStorageChanges((changed) => {
      if (changed === collection) void refresh();
    });
  }, [storage, collection, refresh]);

  return { data, loading, refreshing, refresh, setData };
}
