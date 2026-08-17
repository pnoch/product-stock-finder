import { Product, TagDefinition } from "./types";

export const TAG_PALETTE: string[] = [
  "#0F52BA",
  "#00C896",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#64748B",
];

export function getTagById(
  defs: Record<string, TagDefinition>,
  id: string,
): TagDefinition | undefined {
  return defs[id];
}

export function tagColor(
  defs: Record<string, TagDefinition>,
  id: string,
): string {
  return getTagById(defs, id)?.color ?? TAG_PALETTE[0];
}

export function nextTagColor(
  defs: Record<string, TagDefinition>,
): string {
  const used = new Set(Object.values(defs).map((d) => d.color));
  const free = TAG_PALETTE.find((c) => !used.has(c));
  if (free) return free;
  const last = Object.values(defs).at(-1);
  if (!last) return TAG_PALETTE[0];
  const idx = TAG_PALETTE.indexOf(last.color);
  return TAG_PALETTE[(idx + 1) % TAG_PALETTE.length];
}

export function matchesTagFilter(
  product: Product,
  selectedTagIds: string[],
): boolean {
  if (selectedTagIds.length === 0) return true;
  const selected = new Set(selectedTagIds);
  return (product.tags ?? []).some((id) => selected.has(id));
}

export function generateTagId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}