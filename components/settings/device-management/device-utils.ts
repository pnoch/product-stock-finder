export function platformLabel(platform: string | null): string {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return "Unknown";
}

export function formatLastSeen(lastSeenAt: number, now: number): string {
  if (!lastSeenAt) return "last seen unknown";
  const diff = Math.max(0, now - lastSeenAt);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "last seen just now";
  if (minutes < 60) return `last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last seen ${days}d ago`;
}
