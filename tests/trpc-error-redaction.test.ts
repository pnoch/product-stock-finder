import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { redactErrorShape, GENERIC_ERR_MSG } from "../server/_core/trpc";

describe("tRPC error shape redaction", () => {
  it("replaces an unexpected error message with a generic one", () => {
    const shape = { code: "INTERNAL_SERVER_ERROR", message: "ER_DUP_ENTRY: Duplicate entry 'x'" };
    const error = { cause: new Error("ER_DUP_ENTRY: Duplicate entry 'x'") };
    expect(redactErrorShape(shape, error)).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: GENERIC_ERR_MSG,
    });
  });

  it("preserves a deliberate TRPCError message", () => {
    const shape = { code: "NOT_FOUND", message: "Share not found" };
    const error = new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
    expect(redactErrorShape(shape, error)).toEqual({
      code: "NOT_FOUND",
      message: "Share not found",
    });
  });

  it("preserves auth/device-revoked messages the client matches on", () => {
    for (const message of [
      "Please login (10001)",
      "You do not have required permission (10002)",
      "This device was signed out (10003)",
    ]) {
      const error = new TRPCError({ code: "UNAUTHORIZED", message });
      expect(redactErrorShape({ code: "UNAUTHORIZED", message }, error).message).toBe(message);
    }
  });
});
