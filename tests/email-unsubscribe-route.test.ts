import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

const unsubscribeUser = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../server/notifications/email-alerts", () => ({
  verifyUnsubscribeToken: (id: number, t: string) => t === `tok-${id}`,
  unsubscribeUser,
}));

import { registerUnsubscribeRoute } from "../server/email-unsubscribe-route";

beforeEach(() => {
  unsubscribeUser.mockClear();
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
});
