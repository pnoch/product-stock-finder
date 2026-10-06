// Provider-agnostic telemetry seam. The default is a no-op; a real sink
// (Sentry/PostHog) registers via setTelemetrySink() at app boot. track() must
// never throw — a broken sink cannot crash the app.

export interface TelemetrySink {
  track(event: string, props?: Record<string, unknown>): void;
}

let sink: TelemetrySink | null = null;

export function setTelemetrySink(s: TelemetrySink | null): void {
  sink = s;
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (!sink) return;
  try {
    const result = sink.track(event, props) as unknown;
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Telemetry must never break the app.
  }
}
