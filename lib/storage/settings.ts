import type { AppSettings, TagDefinition } from "../types";
import { generateTagId } from "../tags";
import type { StorageContext } from "./context";
import { quarantinePayload } from "./context";
import type { createWatchlistStorage } from "./watchlist";

type WatchlistReader = Pick<
  ReturnType<typeof createWatchlistStorage>,
  "getWatchlist" | "updateWatchlist"
>;

export function createSettingsStorage(
  ctx: StorageContext,
  watchlist: WatchlistReader,
) {
  const { adapter, KEYS, notify, enqueue } = ctx;
  const { getWatchlist, updateWatchlist } = watchlist;

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
    let raw: string | null;
    try {
      raw = await adapter.getItem(KEYS.SETTINGS);
    } catch (error) {
      console.warn("[storage] read failed for app_settings", error);
      throw error;
    }
    if (!raw) return DEFAULT_SETTINGS;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("settings payload must be an object");
      }
      return { ...DEFAULT_SETTINGS, ...(parsed as Partial<AppSettings>) };
    } catch {
      await quarantinePayload(adapter, KEYS.SETTINGS, raw);
      console.warn("[storage] quarantined corrupt payload for app_settings");
      return DEFAULT_SETTINGS;
    }
  }

  async function saveSettings(settings: AppSettings): Promise<void> {
    await enqueue(KEYS.SETTINGS, async () => {
      await adapter.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    });
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
    await updateTagDefinitions(() => defs);
  }

  // Enqueued read-modify-write so concurrent tag mutations never lose
  // definitions. The duplicate check must run inside the queue too.
  async function updateTagDefinitions(
    fn: (
      defs: Record<string, TagDefinition>,
    ) => Record<string, TagDefinition>,
  ): Promise<Record<string, TagDefinition>> {
    let next: Record<string, TagDefinition> = {};
    await enqueue(KEYS.SETTINGS, async () => {
      const settings = await getSettings();
      next = fn(settings.tagDefinitions ?? {});
      await adapter.setItem(
        KEYS.SETTINGS,
        JSON.stringify({ ...settings, tagDefinitions: next }),
      );
    });
    return next;
  }

  async function setProductTags(
    productId: string,
    tags: string[],
  ): Promise<void> {
    await updateWatchlist((list) =>
      list.map((p) => (p.id === productId ? { ...p, tags } : p)),
    );
    notify("watchlist", productId);
  }

  async function addTagsToProducts(
    productIds: string[],
    tagIds: string[],
  ): Promise<void> {
    await updateWatchlist((list) => {
      const idSet = new Set(productIds);
      return list.map((p) =>
        idSet.has(p.id)
          ? { ...p, tags: Array.from(new Set([...(p.tags ?? []), ...tagIds])) }
          : p,
      );
    });
    for (const id of productIds) notify("watchlist", id);
  }

  async function createTag(
    name: string,
    color: string,
  ): Promise<TagDefinition> {
    const trimmed = name.trim();
    let created: TagDefinition | undefined;
    await updateTagDefinitions((defs) => {
      const duplicate = Object.values(defs).some(
        (d) => d.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) throw new Error("A tag with that name already exists");
      created = { id: generateTagId(), name: trimmed, color };
      return { ...defs, [created.id]: created };
    });
    return created!;
  }

  async function renameTag(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    await updateTagDefinitions((defs) => {
      const existing = defs[id];
      if (!existing) return defs;
      const duplicate = Object.values(defs).some(
        (d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) throw new Error("A tag with that name already exists");
      return { ...defs, [id]: { ...existing, name: trimmed } };
    });
  }

  async function setTagColor(id: string, color: string): Promise<void> {
    await updateTagDefinitions((defs) => {
      const existing = defs[id];
      if (!existing) return defs;
      return { ...defs, [id]: { ...existing, color } };
    });
  }

  async function deleteTag(id: string): Promise<void> {
    let deleted = false;
    await updateTagDefinitions((defs) => {
      if (!defs[id]) return defs;
      deleted = true;
      const rest: Record<string, TagDefinition> = {};
      for (const [key, value] of Object.entries(defs)) {
        if (key !== id) rest[key] = value;
      }
      return rest;
    });
    if (!deleted) return;
    const touched: string[] = [];
    await updateWatchlist((list) =>
      list.map((p) => {
        if (!p.tags?.includes(id)) return p;
        touched.push(p.id);
        return { ...p, tags: (p.tags ?? []).filter((t) => t !== id) };
      }),
    );
    for (const productId of touched) notify("watchlist", productId);
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
