import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { llmRouter } from "./routers/llm";
import { discoveryRouter } from "./routers/discovery";
import { trendingRouter } from "./routers/trending";
import { healthRouter } from "./routers/health";
import { fxRouter } from "./routers/fx";
import { insightsRouter } from "./routers/insights";
import { imagesRouter } from "./routers/images";
import { productsRouter } from "./routers/products";
import { authRouter } from "./routers/auth";
import { syncRouter } from "./routers/sync";
import { pricesRouter } from "./routers/prices";
import { notificationsRouter } from "./routers/notifications";
import { devicesRouter } from "./routers/devices";
import { sharedWatchlistsRouter } from "./routers/shared-watchlists";
import { catalogRouter } from "./routers/catalog";

export { getOrigin } from "./routers/helpers";
export { clearHealthCacheForTests } from "./routers/health";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,

  sync: syncRouter,

  prices: pricesRouter,

  health: healthRouter,

  fx: fxRouter,

  insights: insightsRouter,

  images: imagesRouter,

  products: productsRouter,

  notifications: notificationsRouter,

  discovery: discoveryRouter,

  llm: llmRouter,

  trending: trendingRouter,

  devices: devicesRouter,

  sharedWatchlists: sharedWatchlistsRouter,

  catalog: catalogRouter,
});

export type AppRouter = typeof appRouter;
