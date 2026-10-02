import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

const unsubscribeUser = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../server/notifications/email-alerts", () => ({
  verifyUnsubscribeToken: (id: number, t: string) => t === `tok-${id}`,
  unsubscribeUser,
}));

import { registerUnsubscribeRoute } from "../server/email-unsubscribe-route";
import { clearRateLimitsForTests } from "../server/rate-limit";

beforeEach(() => {
  clearRateLimitsForTests();
  unsubscribeUser.mockReset();
  unsubscribeUser.mockResolvedValue(true);
});

function serve() {
  const app = express();
  registerUnsubscribeRoute(app);
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  return {
    fetch: (p: string) => fetch(`http://127.0.0.1:${port}${p}`),
    close: () => server.close(),
  };
}

describe("GET /api/email/unsubscribe", () => {
  it("flips the flag and confirms for a valid token", async () => {
    const s = serve();
    try {
      const res = await s.fetch(`/api/email/unsubscribe?u=7&t=tok-7`);
      expect(res.status).toBe(200);
      expect(await res.text()).toMatch(/unsubscribed/i);
      expect(unsubscribeUser).toHaveBeenCalledWith(7);
    } finally {
      s.close();
    }
  });

  it("rejects an invalid token", async () => {
    const s = serve();
    try {
      const res = await s.fetch(`/api/email/unsubscribe?u=7&t=bad`);
      expect(res.status).toBe(400);
      expect(unsubscribeUser).not.toHaveBeenCalled();
    } finally {
      s.close();
    }
  });

  it("rate-limits excessive requests with 429", async () => {
    const s = serve();
    try {
      // 30 allowed per minute per IP; the 31st must be 429 (not a hung request).
      for (let i = 0; i < 30; i++) {
        await s.fetch(`/api/email/unsubscribe?u=7&t=tok-7`);
      }
      const limited = await s.fetch(`/api/email/unsubscribe?u=7&t=tok-7`);
      expect(limited.status).toBe(429);
    } finally {
      s.close();
    }
  });

  it("returns 500 when the unsubscribe write fails", async () => {
    unsubscribeUser.mockResolvedValueOnce(false);
    const s = serve();
    try {
      const res = await s.fetch(`/api/email/unsubscribe?u=7&t=tok-7`);
      expect(res.status).toBe(500);
    } finally {
      s.close();
    }
  });
});
