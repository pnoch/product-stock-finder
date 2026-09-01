import { TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { DEVICE_REVOKED_ERR_MSG } from "../../shared/const.js";
import { HttpError } from "../../shared/_core/errors.js";
import { isDeviceRevoked } from "../devices";
import { sdk, type AuthenticatedUser } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  deviceId: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures — only swallow auth failures.
    if (error instanceof HttpError && error.statusCode === 403) {
      user = null;
    } else {
      throw error;
    }
  }

  const rawDeviceId = opts.req.headers["x-device-id"];
  const headerDeviceId = typeof rawDeviceId === "string" ? rawDeviceId : null;
  const claimDeviceId = user?.sessionDeviceId ?? null;
  const effectiveDeviceId = user ? (claimDeviceId ?? headerDeviceId) : null;

  if (effectiveDeviceId && user) {
    const revoked = await isDeviceRevoked(user.id, effectiveDeviceId);
    if (revoked) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: DEVICE_REVOKED_ERR_MSG,
      });
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    deviceId: effectiveDeviceId,
  };
}
