export type EnvIssueLevel = "error" | "warn";

export interface EnvIssue {
  level: EnvIssueLevel;
  message: string;
}

function hasValue(env: NodeJS.ProcessEnv, key: string): boolean {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0;
}

interface FeatureGroup {
  label: string;
  slots: readonly (readonly string[])[];
}

const FEATURE_GROUPS: readonly FeatureGroup[] = [
  {
    label: "Google OAuth",
    slots: [
      ["GOOGLE_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_CLIENT_ID"],
      ["GOOGLE_CLIENT_SECRET"],
    ],
  },
  {
    label: "Apple OAuth",
    slots: [
      ["APPLE_CLIENT_ID", "EXPO_PUBLIC_APPLE_CLIENT_ID"],
      ["APPLE_TEAM_ID"],
      ["APPLE_KEY_ID"],
      ["APPLE_PRIVATE_KEY"],
    ],
  },
  {
    label: "Web push (VAPID)",
    slots: [["VAPID_SUBJECT"], ["VAPID_PUBLIC_KEY"], ["VAPID_PRIVATE_KEY"]],
  },
  { label: "Transactional email", slots: [["RESEND_API_KEY"], ["EMAIL_FROM"]] },
];

function partialGroupIssue(
  env: NodeJS.ProcessEnv,
  group: FeatureGroup,
): EnvIssue | null {
  const satisfied = group.slots.map((slot) =>
    slot.some((key) => hasValue(env, key)),
  );
  const present = satisfied.filter(Boolean).length;
  if (present === 0 || present === group.slots.length) return null;
  const missing = group.slots
    .filter((_, i) => !satisfied[i])
    .map((slot) => slot.join(" or "));
  return {
    level: "warn",
    message: `${group.label} is only partially configured; missing ${missing.join(", ")}`,
  };
}

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
      message:
        "DATABASE_URL must be set in production (sync, auth and shares are disabled without it)",
    });
  }
  for (const group of FEATURE_GROUPS) {
    const issue = partialGroupIssue(env, group);
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
    throw new Error(
      "Server environment validation failed (see [env] errors above)",
    );
  }
}
