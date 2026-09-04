export interface AndroidIntentFilterData {
  scheme?: string;
  host?: string;
  pathPrefix?: string;
}

export interface AndroidIntentFilter {
  action: string;
  autoVerify?: boolean;
  data: AndroidIntentFilterData[];
  category: string[];
}

export function getWebLinkHost(webUrl?: string): string | undefined {
  if (!webUrl) return undefined;
  try {
    const host = new URL(webUrl).hostname.trim().toLowerCase();
    return host || undefined;
  } catch {
    return undefined;
  }
}

export function getAndroidIntentFilters(options: {
  scheme: string;
  webHost?: string;
}): AndroidIntentFilter[] {
  const filters: AndroidIntentFilter[] = [
    {
      action: "VIEW",
      autoVerify: true,
      data: [{ scheme: options.scheme, host: "*" }],
      category: ["BROWSABLE", "DEFAULT"],
    },
  ];
  const webHost = options.webHost?.trim().toLowerCase().replace(/\.$/, "");
  if (webHost) {
    filters.push({
      action: "VIEW",
      autoVerify: true,
      data: [{ scheme: "https", host: webHost }],
      category: ["BROWSABLE", "DEFAULT"],
    });
  }
  return filters;
}

export function getIosAssociatedDomains(webHost?: string): string[] {
  const host = webHost?.trim().toLowerCase().replace(/\.$/, "");
  return host ? [`applinks:${host}`] : [];
}
