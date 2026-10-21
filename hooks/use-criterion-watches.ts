import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { getCriterionWatches, removeCriterionWatch } from "@/lib/storage";
import { showAlert } from "@/lib/alert";
import type { CriterionWatch } from "@/lib/types";

export function useCriterionWatches(refreshing: boolean, loading: boolean) {
  const [criterionWatches, setCriterionWatches] = useState<CriterionWatch[]>(
    [],
  );

  const loadCriterionWatches = useCallback(async () => {
    try {
      setCriterionWatches(await getCriterionWatches());
    } catch {
      setCriterionWatches([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getCriterionWatches()
      .then((watches) => {
        if (active) setCriterionWatches(watches);
      })
      .catch(() => {
        if (active) setCriterionWatches([]);
      });
    return () => {
      active = false;
    };
  }, [refreshing, loading]);

  // Reload on focus so a watch created on the board appears when the user
  // returns to this tab (the effect above only fires on mount/refresh).
  useFocusEffect(
    useCallback(() => {
      void loadCriterionWatches();
    }, [loadCriterionWatches]),
  );

  const handleRemoveCriterionWatch = useCallback(
    async (id: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await removeCriterionWatch(id);
        await loadCriterionWatches();
      } catch {
        showAlert(
          "Remove failed",
          "We couldn't remove that watch. Please try again.",
        );
      }
    },
    [loadCriterionWatches],
  );

  return {
    criterionWatches,
    loadCriterionWatches,
    handleRemoveCriterionWatch,
  };
}
