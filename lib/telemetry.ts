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
    sink.track(event, props);
  } catch {
    // Telemetry must never break the app.
  }
}
