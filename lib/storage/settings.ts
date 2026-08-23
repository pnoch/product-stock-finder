import type { AppSettings, TagDefinition } from "../types";
import { generateTagId } from "../tags";
import type { StorageContext } from "./context";
import type { createWatchlistStorage } from "./watchlist";

type WatchlistReader = Pick<
  ReturnType<typeof createWatchlistStorage>,
  "getWatchlist" | "saveWatchlist"
>;

export function createSettingsStorage(
  ctx: StorageContext,
  watchlist: WatchlistReader,
) {
  const { adapter, KEYS, notify, enqueue } = ctx;
  const { getWatchlist, saveWatchlist } = watchlist;

  const DEFAULT_SETTINGS: AppSettings = {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
    shippingRegion: "Asia-Pacific",
    webNotificationsEnabled: false,
    watchlistSort: "recent",
    watchlistGroup: "off",
  };

  // ─── Settings ───────────────────────────────────────────────────────────────

  async function getSettings(): Promise<AppSettings> {
    try {
      const raw = await adapter.getItem(KEYS.SETTINGS);
      return raw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async function saveSettings(settings: AppSettings): Promise<void> {
    await adapter.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    notify("settings", "settings");
  }

  // ─── Tags ──────────────────────────────────────────────────────────────────

  async function getTagDefinitions(): Promise<Record<string, TagDefinition>> {
    const settings = await getSettings();
    return settings.tagDefinitions ?? {};
  }

  async function saveTagDefinitions(
    defs: Record<string, TagDefinition>,
  ): Promise<void> {
    const settings = await getSettings();
    await saveSettings({ ...settings, tagDefinitions: defs });
  }

  async function setProductTags(
    productId: string,
    tags: string[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) =>
        p.id === productId ? { ...p, tags } : p,
      );
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }

  async function addTagsToProducts(
    productIds: string[],
    tagIds: string[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const idSet = new Set(productIds);
      const updated = list.map((p) =>
        idSet.has(p.id)
          ? { ...p, tags: Array.from(new Set([...(p.tags ?? []), ...tagIds])) }
          : p,
      );
      await saveWatchlist(updated);
      for (const id of productIds) notify("watchlist", id);
    });
  }

  async function createTag(
    name: string,
    color: string,
  ): Promise<TagDefinition> {
    const trimmed = name.trim();
    const defs = await getTagDefinitions();
    const duplicate = Object.values(defs).some(
      (d) => d.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) throw new Error("A tag with that name already exists");
    const tag: TagDefinition = { id: generateTagId(), name: trimmed, color };
    await saveTagDefinitions({ ...defs, [tag.id]: tag });
    return tag;
  }

  async function renameTag(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const defs = await getTagDefinitions();
    const existing = defs[id];
    if (!existing) return;
    const duplicate = Object.values(defs).some(
      (d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) throw new Error("A tag with that name already exists");
    await saveTagDefinitions({ ...defs, [id]: { ...existing, name: trimmed } });
  }

  async function setTagColor(id: string, color: string): Promise<void> {
    const defs = await getTagDefinitions();
    const existing = defs[id];
    if (!existing) return;
    await saveTagDefinitions({ ...defs, [id]: { ...existing, color } });
  }

  async function deleteTag(id: string): Promise<void> {
    const defs = await getTagDefinitions();
    if (!defs[id]) return;
    const rest: Record<string, TagDefinition> = {};
    for (const [key, value] of Object.entries(defs)) {
      if (key !== id) rest[key] = value;
    }
    await saveTagDefinitions(rest);
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) =>
        p.tags?.includes(id)
          ? { ...p, tags: (p.tags ?? []).filter((t) => t !== id) }
          : p,
      );
      await saveWatchlist(updated);
      for (const p of updated) notify("watchlist", p.id);
    });
  }

  return {
    getSettings,
    saveSettings,
    getTagDefinitions,
    saveTagDefinitions,
    setProductTags,
    addTagsToProducts,
    createTag,
    renameTag,
    setTagColor,
    deleteTag,
  };
}
