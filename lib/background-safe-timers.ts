// Background-safe timer primitives for the Android background-task path.
//
// On Android, RN's JavaTimerManager drives >0ms setTimeout timers from the
// choreographer's frame callback, which is gated on `isPaused` — timers with
// a positive duration never fire while the app is backgrounded (expo's
// background-task worker only emits a JS event; it never starts a headless
// JS task, which is what would unpause timers). 0ms timers bypass the frame
// callback entirely (createAndMaybeCallTimer → callTimers, gated only on an
// active React instance), so they DO fire while backgrounded.
//
// These primitives therefore schedule only 0ms timers and re-check wall-clock
// time on every tick while a "background" app state is reported. In the
// foreground (and on iOS/web/server, which never report "background") they
// use a plain setTimeout.
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

/**
 * Resolves after at least `ms` of wall-clock time. While backgrounded on
 * Android it polls with 0ms timers (which still fire) instead of a single
 >0ms timer (which would freeze). Each tick checks Date.now() and resolves
 * once the deadline has passed; the poll loop also self-terminates if the
 * app returns to the foreground (the plain setTimeout path takes over).
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
      if (!isBackgrounded()) {
        setTimeout(resolve, Math.max(0, deadline - Date.now()));
        return;
      }
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  });
}

/**
 * Promise.race against a background-safe timeout. Resolves `undefined` when
 * the deadline passes first. While backgrounded the timeout is driven by the
 * 0ms-timer poll loop, so it fires even though frame-driven timers are
 * frozen. Cleans up the timer when either side settles.
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
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const timeout = new Promise<undefined>((resolve) => {
    const tick = () => {
      if (settled) return;
      if (Date.now() >= deadline) {
        settled = true;
        resolve(undefined);
        return;
      }
      if (!isBackgrounded()) {
        pollTimer = setTimeout(tick, Math.max(0, deadline - Date.now()));
        return;
      }
      pollTimer = setTimeout(tick, 0);
    };
    pollTimer = setTimeout(tick, 0);
  });
  return Promise.race([promise, timeout]).finally(() => {
    settled = true;
    if (pollTimer !== undefined) clearTimeout(pollTimer);
  });
}