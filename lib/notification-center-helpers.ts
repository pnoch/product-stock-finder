export type HealthIconName =
  | "checkmark.circle.fill"
  | "exclamationmark.triangle.fill";

export function healthIcon(status?: string): HealthIconName {
  return status === "recovered" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill";
}
export function healthColor(status?: string): "warning" | "success" {
  return status === "recovered" ? "success" : "warning";
}
