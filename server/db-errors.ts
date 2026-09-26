/**
 * MySQL error classification that unwraps Drizzle's error chain.
 *
 * Drizzle 0.44 wraps driver errors in `DrizzleQueryError`, whose `message` is
 * "Failed query: …" and which does **not** expose `code`/`errno` — the MySQL
 * values live on `.cause`. Checking only the top level (as two copies of this
 * helper did) made every duplicate-key insert rethrow: `uploadConfig` 500'd in a
 * permanent client retry loop, and a duplicate event aborted a whole warmer tick.
 */
function findCauseWith(error: unknown, matches: (e: Record<string, unknown>) => boolean): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
    const candidate = current as Record<string, unknown>;
    if (matches(candidate)) return true;
    const next = candidate.cause;
    if (next === current) break;
    current = next;
  }
  return false;
}

export function isDuplicateKeyError(error: unknown): boolean {
  return findCauseWith(error, (e) => {
    return (
      e.code === "ER_DUP_ENTRY" ||
      e.errno === 1062 ||
      /Duplicate entry/i.test(typeof e.message === "string" ? e.message : "")
    );
  });
}

export function isForeignKeyError(error: unknown): boolean {
  return findCauseWith(error, (e) => {
    return (
      e.code === "ER_NO_REFERENCED_ROW_2" ||
      e.errno === 1452 ||
      /foreign key constraint fails/i.test(
        typeof e.message === "string" ? e.message : "",
      )
    );
  });
}
