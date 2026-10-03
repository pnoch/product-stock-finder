import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import {
  listDevicesForUser,
  getDeviceBinding,
  renameDevice,
  signOutDevice,
  cleanupStaleDevices,
  STALE_DEVICE_MS,
} from "../devices";

export const devicesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    checkRateLimit(ctx, "devices.list", 30, 60_000);
    const devices = await listDevicesForUser(ctx.user.id);
    return { devices };
  }),
  current: protectedProcedure
    .input(z.object({ deviceId: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "devices.current", 30, 60_000);
      const { userId } = await getDeviceBinding(input.deviceId);
      // Only reveal binding to its owner; enumeration without auth is denied
      // by protectedProcedure, and cross-user checks avoid leaking existence.
      if (userId !== null && userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return { deviceId: input.deviceId, userId };
    }),
  rename: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().min(1).max(128),
        label: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkRateLimit(ctx, "devices.rename", 10, 60_000);
      const renamed = await renameDevice(
        ctx.user.id,
        input.deviceId,
        input.label,
      );
      return { renamed };
    }),
  signOut: protectedProcedure
    .input(z.object({ deviceId: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      checkRateLimit(ctx, "devices.signOut", 10, 60_000);
      const signedOut = await signOutDevice(ctx.user.id, input.deviceId);
      return { signedOut };
    }),
  cleanupStale: protectedProcedure.mutation(async ({ ctx }) => {
    checkRateLimit(ctx, "devices.cleanupStale", 10, 60_000);
    const removed = await cleanupStaleDevices(
      ctx.user.id,
      Date.now() - STALE_DEVICE_MS,
      ctx.deviceId,
    );
    return { removed };
  }),
});
