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

  // The web app is served same-origin by the API server, so a host-only cookie
  // is correct and avoids the public-suffix problem entirely. A shared parent
  // domain is only used when explicitly configured (e.g. api.example.com +
  // app.example.com), because guessing it breaks on hosts like
  // `myapp.vercel.app` / `user.github.io` where the browser rejects a cookie
  // whose Domain is a public suffix (login appears to succeed but never sticks).
  const configured = process.env.COOKIE_DOMAIN?.trim();
  if (configured) {
    return configured.startsWith(".") ? configured : `.${configured}`;
  }
  return undefined;
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
