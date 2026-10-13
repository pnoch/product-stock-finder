import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

export type MarketplaceSite = "facebook" | "shopee" | "lazada";

export const MARKETPLACE_SITES = [
  "facebook",
  "shopee",
  "lazada",
] as const satisfies readonly MarketplaceSite[];

export const MARKETPLACE_CONNECTIONS_KEY = "marketplace_connections_v1";
export const FACEBOOK_SEARCH_PREFERENCES_KEY = "facebook_search_preferences_v1";

const probeCapabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("search"), query: z.string() }),
  z.object({ kind: z.literal("listing"), productId: z.string() }),
  z.object({ kind: z.literal("navigation") }),
]);

const verificationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("not_checked") }),
  z.object({ kind: z.literal("checking") }),
  z.object({
    kind: z.literal("ready"),
    checkedAt: z.string(),
    capability: probeCapabilitySchema,
  }),
  z.object({ kind: z.literal("login_required"), checkedAt: z.string() }),
  z.object({
    kind: z.literal("unverified"),
    checkedAt: z.string(),
    reason: z.string(),
  }),
  z.object({ kind: z.literal("unavailable") }),
]);

const connectionsSchema = z.object({
  facebook: verificationSchema.optional(),
  shopee: verificationSchema.optional(),
  lazada: verificationSchema.optional(),
});

const preferencesSchema = z.object({
  requestedArea: z.string(),
  requestedRadiusKm: z.union([z.literal(10), z.literal(30), z.literal(64)]),
});

export type ProbeCapability = z.infer<typeof probeCapabilitySchema>;
export type Verification = z.infer<typeof verificationSchema>;
export type FacebookSearchPreference = z.infer<typeof preferencesSchema>;

export interface ObservedSearchScope {
  area: string | null;
  radiusKm: number | null;
}

export interface MarketplaceSiteConfig {
  readonly label: string;
  readonly homeUrl: string;
  readonly allowedHosts: readonly string[];
}

export const MARKETPLACE_SITE_CONFIG: Record<
  MarketplaceSite,
  MarketplaceSiteConfig
> = {
  facebook: {
    label: "Facebook Marketplace",
    homeUrl: "https://www.facebook.com/marketplace/",
    allowedHosts: ["www.facebook.com", "web.facebook.com", "m.facebook.com"],
  },
  shopee: {
    label: "Shopee Thailand",
    homeUrl: "https://shopee.co.th/",
    allowedHosts: ["shopee.co.th"],
  },
  lazada: {
    label: "Lazada Thailand",
    homeUrl: "https://www.lazada.co.th/",
    allowedHosts: ["www.lazada.co.th"],
  },
};

export const NOT_CHECKED: Verification = { kind: "not_checked" };

export const DEFAULT_FACEBOOK_SEARCH_PREFERENCE: FacebookSearchPreference = {
  requestedArea: "",
  requestedRadiusKm: 64,
};

export function marketplaceHomeUrl(site: MarketplaceSite): string {
  return MARKETPLACE_SITE_CONFIG[site].homeUrl;
}

export function marketplaceAllowedHosts(
  site: MarketplaceSite,
): readonly string[] {
  return MARKETPLACE_SITE_CONFIG[site].allowedHosts;
}

export function isMarketplaceUrlAllowed(
  site: MarketplaceSite,
  raw: string,
): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  return marketplaceAllowedHosts(site).includes(url.hostname.toLowerCase());
}

export type MarketplaceConnectionEvent =
  | {
      type: "verification";
      site: MarketplaceSite;
      verification: Verification;
    }
  | { type: "preferences"; preferences: FacebookSearchPreference };

export interface MarketplaceConnectionsService {
  load(): Promise<void>;
  whenIdle(): Promise<void>;
  current(site: MarketplaceSite): Verification;
  preferences(): FacebookSearchPreference;
  setPreferences(preference: FacebookSearchPreference): Promise<void>;
  beginVerification(site: MarketplaceSite): number;
  complete(
    site: MarketplaceSite,
    generation: number,
    verification: Verification,
  ): Promise<void>;
  invalidate(site: MarketplaceSite): Promise<void>;
  subscribe(listener: (event: MarketplaceConnectionEvent) => void): () => void;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cloneVerification(verification: Verification): Verification {
  switch (verification.kind) {
    case "ready":
      return {
        kind: "ready",
        checkedAt: verification.checkedAt,
        capability: { ...verification.capability },
      };
    case "login_required":
      return {
        kind: "login_required",
        checkedAt: verification.checkedAt,
      };
    case "unverified":
      return {
        kind: "unverified",
        checkedAt: verification.checkedAt,
        reason: verification.reason,
      };
    case "checking":
      return { kind: "checking" };
    case "unavailable":
      return { kind: "unavailable" };
    case "not_checked":
      return { kind: "not_checked" };
  }
}

function defaultStates(): Record<MarketplaceSite, Verification> {
  return { facebook: NOT_CHECKED, shopee: NOT_CHECKED, lazada: NOT_CHECKED };
}

class MarketplaceConnectionsServiceImpl implements MarketplaceConnectionsService {
  private states: Record<MarketplaceSite, Verification> = defaultStates();
  // Bumped whenever a new verification starts or a disconnect begins, so a
  // completion from a superseded operation cannot persist or notify.
  private generations: Record<MarketplaceSite, number> = {
    facebook: 0,
    shopee: 0,
    lazada: 0,
  };
  private prefs: FacebookSearchPreference = {
    ...DEFAULT_FACEBOOK_SEARCH_PREFERENCE,
  };
  private listeners = new Set<(event: MarketplaceConnectionEvent) => void>();
  private chain: Promise<unknown> = Promise.resolve();

  async load(): Promise<void> {
    await this.loadConnections();
    await this.loadPreferences();
  }

  private async loadConnections(): Promise<void> {
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(MARKETPLACE_CONNECTIONS_KEY);
    } catch {
      raw = null;
    }
    if (raw == null) return;
    const parsed = connectionsSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      this.states = defaultStates();
      await this.enqueue(() => this.writeConnections());
      return;
    }
    for (const site of MARKETPLACE_SITES) {
      this.states[site] = parsed.data[site] ?? NOT_CHECKED;
    }
  }

  private async loadPreferences(): Promise<void> {
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(FACEBOOK_SEARCH_PREFERENCES_KEY);
    } catch {
      raw = null;
    }
    if (raw == null) return;
    const parsed = preferencesSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      this.prefs = { ...DEFAULT_FACEBOOK_SEARCH_PREFERENCE };
      await this.enqueue(() => this.writePreferences());
      return;
    }
    this.prefs = parsed.data;
  }

  current(site: MarketplaceSite): Verification {
    return cloneVerification(this.states[site]);
  }

  preferences(): FacebookSearchPreference {
    return { ...this.prefs };
  }

  async setPreferences(preference: FacebookSearchPreference): Promise<void> {
    const parsed = preferencesSchema.safeParse(preference);
    if (!parsed.success) return;
    this.prefs = parsed.data;
    try {
      await this.enqueue(() => this.writePreferences());
    } catch {
      return;
    }
    this.emit({ type: "preferences", preferences: this.preferences() });
  }

  beginVerification(site: MarketplaceSite): number {
    const generation = this.generations[site] + 1;
    this.generations[site] = generation;
    this.states[site] = { kind: "checking" };
    void this.persistVerification(site, generation);
    return generation;
  }

  async complete(
    site: MarketplaceSite,
    generation: number,
    verification: Verification,
  ): Promise<void> {
    if (this.generations[site] !== generation) return;
    const parsed = verificationSchema.safeParse(verification);
    if (!parsed.success) return;
    this.states[site] = parsed.data;
    await this.persistVerification(site, generation);
  }

  async invalidate(site: MarketplaceSite): Promise<void> {
    const generation = this.generations[site] + 1;
    this.generations[site] = generation;
    this.states[site] = { kind: "not_checked" };
    await this.persistVerification(site, generation);
  }

  subscribe(listener: (event: MarketplaceConnectionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async whenIdle(): Promise<void> {
    await this.chain;
  }

  private async persistVerification(
    site: MarketplaceSite,
    generation: number,
  ): Promise<void> {
    try {
      await this.enqueue(() => this.writeConnections());
    } catch {
      return;
    }
    if (this.generations[site] !== generation) return;
    this.emit({
      type: "verification",
      site,
      verification: this.current(site),
    });
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => {});
    return next;
  }

  private async writeConnections(): Promise<void> {
    await AsyncStorage.setItem(
      MARKETPLACE_CONNECTIONS_KEY,
      JSON.stringify(this.states),
    );
  }

  private async writePreferences(): Promise<void> {
    await AsyncStorage.setItem(
      FACEBOOK_SEARCH_PREFERENCES_KEY,
      JSON.stringify(this.prefs),
    );
  }

  private emit(event: MarketplaceConnectionEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // Isolate a throwing listener from the remaining subscribers.
      }
    }
  }
}

export function createMarketplaceConnectionsService(): MarketplaceConnectionsService {
  return new MarketplaceConnectionsServiceImpl();
}

let shared: MarketplaceConnectionsService | null = null;

export function getMarketplaceConnectionsService(): MarketplaceConnectionsService {
  if (!shared) shared = createMarketplaceConnectionsService();
  return shared;
}
