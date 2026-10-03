export type EnvIssueLevel = "error" | "warn";

export interface EnvIssue {
  level: EnvIssueLevel;
  message: string;
}

function hasValue(env: NodeJS.ProcessEnv, key: string): boolean {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0;
}

function partialGroupIssue(
  env: NodeJS.ProcessEnv,
  label: string,
  keys: readonly string[],
): EnvIssue | null {
  const missing = keys.filter((key) => !hasValue(env, key));
  if (missing.length === 0 || missing.length === keys.length) return null;
  return {
    level: "warn",
    message: `${label} is only partially configured; missing ${missing.join(", ")}`,
  };
}

const FEATURE_GROUPS = [
  ["Google OAuth", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]],
  ["Apple OAuth", ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"]],
  ["Web push (VAPID)", ["VAPID_SUBJECT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]],
  ["Transactional email", ["RESEND_API_KEY", "EMAIL_FROM"]],
] as const satisfies readonly (readonly [string, readonly string[]])[];

/**
 * Pure check of the server environment. Production-only problems are `error`
 * (a misconfigured deploy must fail at boot); everything else is a `warn` so
 * local-only mode still runs with no server config.
 */
export function validateServerEnv(env: NodeJS.ProcessEnv): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProduction = env.NODE_ENV === "production";

  if (isProduction && !hasValue(env, "DATABASE_URL")) {
    issues.push({
      level: "error",
      message: "DATABASE_URL must be set in production (sync, auth and shares are disabled without it)",
    });
  }
  if (isProduction && !hasValue(env, "CORS_ALLOWED_ORIGINS")) {
    issues.push({
      level: "warn",
      message: "CORS_ALLOWED_ORIGINS is empty in production; the web origin will be rejected",
    });
  }
  for (const [label, keys] of FEATURE_GROUPS) {
    const issue = partialGroupIssue(env, label, keys);
    if (issue) issues.push(issue);
  }
  return issues;
}

/** Logs every issue; throws only when a production `error` is present. */
export function assertServerEnv(env: NodeJS.ProcessEnv = process.env): void {
  let hasError = false;
  for (const issue of validateServerEnv(env)) {
    if (issue.level === "error") {
      hasError = true;
      console.error(`[env] ${issue.message}`);
    } else {
      console.warn(`[env] ${issue.message}`);
    }
  }
  if (hasError) {
    throw new Error("Server environment validation failed (see [env] errors above)");
  }
}
