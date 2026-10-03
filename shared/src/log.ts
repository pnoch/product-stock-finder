export const LOG_ERROR: (...args: unknown[]) => void =
  typeof __DEV__ !== "undefined" && __DEV__ ? console.error.bind(console) : () => {};

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSink = (level: LogLevel, args: unknown[]) => void;

let sink: LogSink | null = null;

/** Register a crash-report/monitoring sink; no-op by default. */
export function setLogSink(next: LogSink | null): void {
  sink = next;
}

const isDev =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : typeof process !== "undefined" && process.env
      ? process.env.NODE_ENV !== "production"
      : true;

function emit(level: LogLevel, args: unknown[]): void {
  // The sink is observability-only: it must never throw into app code or
  // suppress the console write. It receives every level, including ones the
  // console then silences in production.
  if (sink) {
    try {
      sink(level, args);
    } catch {
      // ignore sink failures
    }
  }
  if ((level === "debug" || level === "info") && !isDev) return;
  const write =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "info"
          ? console.info
          : console.log;
  write(...args);
}

export const log = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
