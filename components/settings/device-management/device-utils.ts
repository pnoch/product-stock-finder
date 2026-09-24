export { formatLastSeen } from "@/lib/relative-time";

export function platformLabel(platform: string | null): string {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return "Unknown";
}
