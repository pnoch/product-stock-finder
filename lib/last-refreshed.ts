export function formatLastRefreshed(isoString: string | undefined): string {
  if (!isoString) return "Never";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Unknown";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

export function getLastRefreshedColor(
  isoString: string | undefined,
): "green" | "yellow" | "red" | "gray" {
  if (!isoString) return "gray";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "gray";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / 3600000;
    if (diffHours < 1) return "green";
    if (diffHours < 6) return "yellow";
    return "red";
  } catch {
    return "gray";
  }
}
