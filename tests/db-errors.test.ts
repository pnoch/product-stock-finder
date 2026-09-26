import { describe, expect, it } from "vitest";
import { isDuplicateKeyError, isForeignKeyError } from "../server/db-errors";

// Drizzle 0.44 wraps driver errors in DrizzleQueryError: message is
// "Failed query: ..." and code/errno live on .cause. Checking only the top
// level (as two local copies did) made every duplicate-key insert rethrow —
// uploadConfig 500'd in a permanent client retry loop.
const drizzleWrapped = (cause: unknown) => {
  const error = new Error("Failed query: insert into `notification_events` ...");
  Object.assign(error, { cause });
  return error;
};

describe("db-errors", () => {
  it("recognizes a duplicate key wrapped by Drizzle", () => {
    expect(isDuplicateKeyError(drizzleWrapped({ code: "ER_DUP_ENTRY" }))).toBe(true);
    expect(isDuplicateKeyError(drizzleWrapped({ errno: 1062 }))).toBe(true);
    expect(
      isDuplicateKeyError(drizzleWrapped({ message: "Duplicate entry 'x' for key 'PRIMARY'" })),
    ).toBe(true);
    // A nested cause chain is unwrapped too.
    expect(isDuplicateKeyError(drizzleWrapped({ cause: { code: "ER_DUP_ENTRY" } }))).toBe(true);
  });

  it("does not misclassify other errors", () => {
    expect(isDuplicateKeyError(drizzleWrapped({ code: "ER_LOCK_WAIT_TIMEOUT" }))).toBe(false);
    expect(isDuplicateKeyError(new Error("Failed query: select 1"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });

  it("recognizes a foreign key violation wrapped by Drizzle", () => {
    expect(isForeignKeyError(drizzleWrapped({ code: "ER_NO_REFERENCED_ROW_2" }))).toBe(true);
    expect(isForeignKeyError(drizzleWrapped({ errno: 1452 }))).toBe(true);
    expect(isForeignKeyError(drizzleWrapped({ code: "ER_DUP_ENTRY" }))).toBe(false);
  });
});
