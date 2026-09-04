import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  // Only trust X-Forwarded-Proto when Express trust proxy is enabled;
  // otherwise an off-path attacker over HTTP can force or strip Secure.
  const trustProxy = (
    req as unknown as { app?: { get?: (k: string) => unknown } }
  ).app?.get?.("trust proxy");
  if (!trustProxy) return false;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

function getParentDomain(hostname: string): string | undefined {
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  const parts = hostname.split(".");

  if (parts.length < 3) {
    return undefined;
  }

  // Avoid returning a public suffix (e.g. co.uk) as the cookie domain.
  // For known two-label public suffixes, use the last 3 labels.
  const publicSuffixes = new Set(["co.uk", "com.au"]);
  const lastTwo = parts.slice(-2).join(".").toLowerCase();
  if (publicSuffixes.has(lastTwo)) {
    if (parts.length < 4) return undefined;
    return "." + parts.slice(-3).join(".");
  }

  if (parts.length > 3) return undefined;

  return "." + parts.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: isSecureRequest(req) ? "none" : "lax",
    secure: isSecureRequest(req),
  };
}
