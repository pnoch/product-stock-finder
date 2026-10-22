import { useCallback, useEffect, useState } from "react";
import { storage } from "../storage";
import { countQueuedEdits } from "../../../lib/sync";

export function useQueuedCount(): number {
  const [queuedCount, setQueuedCount] = useState(0);

  const refreshQueuedCount = useCallback(async () => {
    try {
      const meta = await storage.getSyncMeta();
      setQueuedCount(countQueuedEdits(meta));
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshQueuedCount();
    });
    window.addEventListener("focus", refreshQueuedCount);
    return () => window.removeEventListener("focus", refreshQueuedCount);
  }, [refreshQueuedCount]);

  return queuedCount;
}
