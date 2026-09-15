import { describe, expect, it } from "vitest";
import { affectedRowsOf } from "../server/db";

describe("affectedRowsOf", () => {
  it("reads the mysql2 tuple shape drizzle actually returns", () => {
    // drizzle-orm/mysql2 resolves a delete to [ResultSetHeader, fields].
    expect(affectedRowsOf([{ affectedRows: 1500 }, []])).toBe(1500);
    expect(affectedRowsOf([{ affectedRows: 0 }, []])).toBe(0);
  });

  it("still handles a plain object result", () => {
    expect(affectedRowsOf({ affectedRows: 7 })).toBe(7);
  });

  it("returns 0 for unexpected shapes", () => {
    expect(affectedRowsOf(undefined)).toBe(0);
    expect(affectedRowsOf(null)).toBe(0);
    expect(affectedRowsOf([{}, []])).toBe(0);
  });
});
