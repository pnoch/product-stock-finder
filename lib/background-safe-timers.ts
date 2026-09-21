// Background-safe timer primitives for the Android background-task path.
//
// On Android (bridgeless / new architecture), ALL setTimeout timers — including
// 0ms — are registered with JavaTimerManager and fired only from the
// choreographer's frame callback, which is gated on `isPaused`. expo's
// background-task worker only emits a JS event; it never starts a headless JS
// task (the thing that would unpause timers), so every setTimeout freezes
// while the app is backgrounded.
//
// setImmediate / queueMicrotask, however, are backed by the JS VM's microtask
// queue (runtime.queueMicrotask → Hermes), drained at each event-loop tick's
// microtask checkpoint — not gated on pause. Microtask chains do run while
// backgrounded, but only in bounded bursts per drain pass, so these primitives
// are best treated as a fallback. The primary background-safe mechanism is the
// NATIVE XHR timeout (lib/background-fetch.ts): fetches enforce their deadline
// in the native networking stack, and rate-limit sleeps are skipped entirely.
//
// In the foreground (and on iOS/web/server, which never report "background")
// these primitives use a plain setTimeout.
//
// This module must stay free of react-native imports: it is imported by
// lib/scrapers/resilient.ts, which the server bundle also pulls in. The app
// state is injected from app/_layout.tsx via setBackgroundAppState.

export type BackgroundAppState = "foreground" | "background";

let appState: BackgroundAppState = "foreground";

export function setBackgroundAppState(state: BackgroundAppState): void {
  appState = state;
}

export function getBackgroundAppState(): BackgroundAppState {
  return appState;
}

function isBackgrounded(): boolean {
  return appState === "background";
}

// While backgrounded, chain via setImmediate (microtask-backed on RN's
// bridgeless runtime, so it survives the paused timer queue). In the
// foreground, fall back to a real timer so we don't busy-spin.
function scheduleTick(backgrounded: boolean, fn: () => void): void {
  if (backgrounded) {
    setImmediate(fn);
  } else {
    setTimeout(fn, 0);
  }
}

/**
 * Resolves after at least `ms` of wall-clock time. While backgrounded on
 * Android it polls via setImmediate (microtasks still drain while the timer
 * queue is frozen) instead of a setTimeout (which would never fire). Each
 * tick checks Date.now() and resolves once the deadline has passed; the poll
 * loop also self-terminates if the app returns to the foreground (a plain
 * setTimeout takes over for the remainder).
 */
export function backgroundSafeDelay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  if (!isBackgrounded()) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  const deadline = Date.now() + ms;
  return new Promise((resolve) => {
    const tick = () => {
      if (Date.now() >= deadline) {
        resolve();
        return;
      }
      const backgrounded = isBackgrounded();
      if (!backgrounded) {
        setTimeout(resolve, Math.max(0, deadline - Date.now()));
        return;
      }
      scheduleTick(backgrounded, tick);
    };
    scheduleTick(true, tick);
  });
}

/**
 * Promise.race against a background-safe timeout. Resolves `undefined` when
 * the deadline passes first. While backgrounded the timeout is driven by the
 * setImmediate poll loop, so it fires even though the timer queue is frozen.
 * Cleans up the timer when either side settles.
 */
export function backgroundSafeRace<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  if (!isBackgrounded()) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
  }
  const deadline = Date.now() + ms;
  let cancelled = false;
  const timeout = new Promise<undefined>((resolve) => {
    const tick = () => {
      if (cancelled) return;
      if (Date.now() >= deadline) {
        cancelled = true;
        resolve(undefined);
        return;
      }
      const backgrounded = isBackgrounded();
      if (!backgrounded) {
        setTimeout(tick, Math.max(0, deadline - Date.now()));
        return;
      }
      scheduleTick(backgrounded, tick);
    };
    scheduleTick(true, tick);
  });
  return Promise.race([promise, timeout]).finally(() => {
    cancelled = true;
  });
}