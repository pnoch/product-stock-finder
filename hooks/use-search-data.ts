import { useCallback, useEffect, useState } from "react";
import { getTagDefinitions, getWatchlist } from "@/lib/storage";
import { Product, TagDefinition } from "@/lib/types";

export function useSearchData() {
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [tagDefinitions, setTagDefinitions] = useState<
    Record<string, TagDefinition>
  >({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");

  const loadData = useCallback(() => {
    getWatchlist().then((wl) => {
      setWatchlist(wl);
      setTrackedIds(new Set(wl.map((p) => p.id)));
    });
    getTagDefinitions()
      .then((defs) => {
        setTagDefinitions(defs);
        setSelectedTagIds((prev) => prev.filter((id) => id in defs));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    watchlist,
    trackedIds,
    tagDefinitions,
    selectedTagIds,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    loadData,
  };
}
