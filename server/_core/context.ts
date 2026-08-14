import { TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { DEVICE_REVOKED_ERR_MSG } from "../../shared/const.js";
import { isDeviceRevoked } from "../devices";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  deviceId: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const rawDeviceId = opts.req.headers["x-device-id"];
  const deviceId = typeof rawDeviceId === "string" ? rawDeviceId : null;

  if (deviceId && user) {
    const revoked = await isDeviceRevoked(deviceId);
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
    deviceId,
  };
}
