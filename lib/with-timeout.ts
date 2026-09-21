// Contract: null means TIMEOUT (or, if T includes null/undefined, ambiguous).
// Never race a nullable-typed promise — callers must race non-null success
// types (boolean/object/string) so null unambiguously signals timeout.
import {
  backgroundSafeRace,
  getBackgroundAppState,
} from "./background-safe-timers";

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  if (getBackgroundAppState() === "background") {
    // Android backgrounded: a plain setTimeout-based race freezes (frame-driven
    // timers are paused), so use the 0ms-timer poll loop. null = timeout.
    return backgroundSafeRace(promise, ms).then(
      (v) => (v === undefined ? null : v),
    );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export function withTimeoutReject<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (getBackgroundAppState() === "background") {
    return backgroundSafeRace(promise, ms).then((v) => {
      if (v === undefined) throw new Error("timeout");
      return v;
    });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}