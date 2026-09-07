import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(timeoutMs = 2500) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), timeoutMs);
    },
    [timeoutMs],
  );
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  return { toast, showToast };
}
