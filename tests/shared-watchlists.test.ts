import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
}));

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { sharedWatchlists, sharedWatchlistMembers } from "../drizzle/schema";
import { getDb, getUserByEmail, getUserById } from "../server/db";

const mockedGetDb = vi.mocked(getDb);
const mockedGetUserByEmail = vi.mocked(getUserByEmail);
const mockedGetUserById = vi.mocked(getUserById);

function createAuthedContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: { headers: {} } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}

function fakeDb(opts: { sharedRows?: unknown[]; watchlistRows?: unknown[]; memberRows?: unknown[] }): unknown {
  const sharedRows = opts.sharedRows ?? [];
  const watchlistRows = opts.watchlistRows ?? [];
  const memberRows = opts.memberRows ?? [];
  return {
    insert: () => ({
      values: () => {
        // Awaitable AND chainable: the create path awaits `.values(...)`, while
        // invite/join call `.values(...).onDuplicateKeyUpdate(...)`.
        const p = Promise.resolve() as Promise<unknown> & {
          onDuplicateKeyUpdate: () => Promise<void>;
        };
        p.onDuplicateKeyUpdate = async () => {};
        return p;
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          let rows =
            table === sharedWatchlists
              ? sharedRows
              : table === sharedWatchlistMembers
                ? memberRows
                : watchlistRows;
          // The router now filters tombstones in SQL (isNull(deletedAtMs));
          // mirror that so the fake DB behaves like the real one.
          if (table !== sharedWatchlists) {
            rows = (rows as { deletedAtMs?: number | null }[]).filter(
              (r) => r.deletedAtMs === null || r.deletedAtMs === undefined,
            );
          }
          const promise: unknown = Promise.resolve(rows);
          (promise as Record<string, unknown>).limit = async (n: number) => (rows as unknown[]).slice(0, n);
          return promise as unknown;
        },
      }),
    }),
    delete: () => ({ where: async () => {} }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  };
}

describe("sharedWatchlists table", () => {
  it("has required columns", async () => {
    const mod = await import("../drizzle/schema");
    expect(mod.sharedWatchlists).toBeDefined();
    expect(mod.sharedWatchlists.token).toBeDefined();
  });
});

describe("sharedWatchlists router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create returns shareUrl with /w/<token>", async () => {
    mockedGetDb.mockResolvedValue(fakeDb({}) as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const res = await caller.sharedWatchlists.create({});
    expect(res.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.shareUrl).toContain(`/w/${res.token}`);
    expect(res.shareUrl).toMatch(/^http:\/\/localhost:8081\/w\//);
  });

  it("create respects EXPO_PUBLIC_WEB_URL origin", async () => {
    const prev = process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_WEB_URL = "https://example.com";
    mockedGetDb.mockResolvedValue(fakeDb({}) as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const res = await caller.sharedWatchlists.create({ title: "My List" });
    expect(res.shareUrl.startsWith("https://example.com/w/")).toBe(true);
    process.env.EXPO_PUBLIC_WEB_URL = prev;
  });

  it("create requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.create({})).rejects.toThrow();
  });

  it("get is public and returns products", async () => {
    const watchlistRows = [
      { deletedAtMs: null, data: { id: "p1", name: "Product 1" } },
      { deletedAtMs: null, data: { id: "p2", name: "Product 2" } },
      { deletedAtMs: 123, data: { id: "p3", name: "Deleted" } },
    ];
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ ownerId: 1, token: "tok123", title: "My Watchlist" }],
        watchlistRows,
      }) as never,
    );
    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.sharedWatchlists.get({ token: "tok123" });
    expect(res.title).toBe("My Watchlist");
    expect(res.products).toHaveLength(2);
    expect(res.products.map((p: unknown) => (p as { id: string }).id)).toEqual(["p1", "p2"]);
  });

  it("get throws NOT_FOUND for unknown token", async () => {
    mockedGetDb.mockResolvedValue(fakeDb({ sharedRows: [] }) as never);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.get({ token: "missing" })).rejects.toThrow(/NOT_FOUND|Share not found/);
  });

  it("caps the returned products and flags truncation", async () => {
    const watchlistRows = Array.from({ length: 600 }, (_, i) => ({
      deletedAtMs: null,
      data: { id: `p${i}`, name: `Product ${i}` },
    }));
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ ownerId: 1, token: "tok123", title: "Big" }],
        watchlistRows,
      }) as never,
    );
    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.sharedWatchlists.get({ token: "tok123" });
    expect(res.products).toHaveLength(500);
    expect(res.truncated).toBe(true);
  });

  // A share with exactly the cap must not be flagged as truncated: the old
  // `items.length >= MAX` check (with `.limit(MAX)`) reported 500-item shares
  // as truncated even though nothing was dropped.
  it("does not flag an exactly-500-product share as truncated", async () => {
    const watchlistRows = Array.from({ length: 500 }, (_, i) => ({
      deletedAtMs: null,
      data: { id: `p${i}`, name: `Product ${i}` },
    }));
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ ownerId: 1, token: "tok123", title: "Exactly 500" }],
        watchlistRows,
      }) as never,
    );
    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.sharedWatchlists.get({ token: "tok123" });
    expect(res.products).toHaveLength(500);
    expect(res.truncated).toBe(false);
  });

  // QA round 281: `get` now reports the viewer's own membership so the shared
  // page can offer Join/Leave (those endpoints previously had no client).
  it("reports owner/member state to the viewer", async () => {
    const sharedRows = [
      { ownerId: 1, token: "tok123", title: "T", expiresAt: null },
    ];
    mockedGetDb.mockResolvedValue(fakeDb({ sharedRows }) as never);
    const owner = appRouter.createCaller(createAuthedContext(1));
    await expect(owner.sharedWatchlists.get({ token: "tok123" })).resolves.toMatchObject({
      isOwner: true,
      isMember: false,
    });

    mockedGetDb.mockResolvedValue(fakeDb({ sharedRows, memberRows: [] }) as never);
    const outsider = appRouter.createCaller(createAuthedContext(2));
    await expect(outsider.sharedWatchlists.get({ token: "tok123" })).resolves.toMatchObject({
      isOwner: false,
      isMember: false,
    });

    mockedGetDb.mockResolvedValue(
      fakeDb({ sharedRows, memberRows: [{ userId: 2 }] }) as never,
    );
    const member = appRouter.createCaller(createAuthedContext(2));
    await expect(member.sharedWatchlists.get({ token: "tok123" })).resolves.toMatchObject({
      isOwner: false,
      isMember: true,
    });
  });

  it("reports false/false membership to a signed-out viewer", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ ownerId: 1, token: "tok123", title: "T", expiresAt: null }],
      }) as never,
    );
    const anon = appRouter.createCaller(createPublicContext());
    await expect(anon.sharedWatchlists.get({ token: "tok123" })).resolves.toMatchObject({
      isOwner: false,
      isMember: false,
    });
  });

  // An expired share must not accept new members: get/members/join all reject
  // expired shares, so invite must too or it silently grants access to a dead
  // share.
  it("refuses to join a members-only share without an invitation", async () => {
    // get gates on membership, so an unconditional insert in join made the
    // members-only setting unenforceable for anyone holding the link.
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ token: "tok-1", expiresAt: null, membersOnly: true }],
        memberRows: [],
      }) as never,
    );
    const caller = appRouter.createCaller(createAuthedContext(9));
    await expect(
      caller.sharedWatchlists.join({ token: "tok-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("joins a members-only share when already invited", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ token: "tok-1", expiresAt: null, membersOnly: true }],
        memberRows: [{ token: "tok-1", userId: 9, role: "viewer" }],
      }) as never,
    );
    const caller = appRouter.createCaller(createAuthedContext(9));
    await expect(
      caller.sharedWatchlists.join({ token: "tok-1" }),
    ).resolves.toEqual({ joined: true });
  });

  it("invite rejects an expired share", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [
          { ownerId: 1, token: "tok123", title: "Old", expiresAt: new Date(Date.now() - 1000) },
        ],
      }) as never,
    );
    const caller = appRouter.createCaller(createAuthedContext(1));
    await expect(
      caller.sharedWatchlists.invite({ token: "tok123", userId: 2, role: "viewer" }),
    ).rejects.toThrow(/expired/i);
  });

  it("revoke requires auth and returns revoked", async () => {
    mockedGetDb.mockResolvedValue(fakeDb({}) as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const res = await caller.sharedWatchlists.revoke({ token: "tok123" });
    expect(res.revoked).toBe(true);
  });

  it("revoke requires auth for public", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.revoke({ token: "tok123" })).rejects.toThrow();
  });

  // Phase 536: invite-by-email + roster management (invite was unreachable from
  // any client because it takes a raw userId).
  it("inviteByEmail resolves the account and invites it as viewer", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({ sharedRows: [{ ownerId: 1, token: "tok123", expiresAt: null }] }) as never,
    );
    mockedGetUserByEmail.mockResolvedValue({ id: 2, name: "Bob", email: "bob@example.com" } as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    await expect(
      caller.sharedWatchlists.inviteByEmail({ token: "tok123", email: "Bob@Example.com" }),
    ).resolves.toMatchObject({ invited: true, name: "Bob" });
    // Emails are matched normalised.
    expect(mockedGetUserByEmail).toHaveBeenCalledWith("bob@example.com");
  });

  it("inviteByEmail rejects an unknown email", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({ sharedRows: [{ ownerId: 1, token: "tok123", expiresAt: null }] }) as never,
    );
    mockedGetUserByEmail.mockResolvedValue(null as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    await expect(
      caller.sharedWatchlists.inviteByEmail({ token: "tok123", email: "nobody@example.com" }),
    ).rejects.toThrow(/No account/i);
  });

  it("inviteByEmail is owner-only", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({ sharedRows: [{ ownerId: 1, token: "tok123", expiresAt: null }] }) as never,
    );
    const caller = appRouter.createCaller(createAuthedContext(2));
    await expect(
      caller.sharedWatchlists.inviteByEmail({ token: "tok123", email: "eve@example.com" }),
    ).rejects.toThrow(/owner/i);
  });

  it("removeMember is owner-only and succeeds for the owner", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({ sharedRows: [{ ownerId: 1, token: "tok123", expiresAt: null }] }) as never,
    );
    const owner = appRouter.createCaller(createAuthedContext(1));
    await expect(
      owner.sharedWatchlists.removeMember({ token: "tok123", userId: 2 }),
    ).resolves.toMatchObject({ removed: true });

    const outsider = appRouter.createCaller(createAuthedContext(2));
    await expect(
      outsider.sharedWatchlists.removeMember({ token: "tok123", userId: 1 }),
    ).rejects.toThrow(/owner/i);
  });

  it("members lists the roster with display names", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ ownerId: 1, token: "tok123", expiresAt: null }],
        memberRows: [{ userId: 2, role: "viewer" }],
      }) as never,
    );
    mockedGetUserById.mockResolvedValue({ id: 2, name: "Bob", email: "bob@example.com" } as never);
    const owner = appRouter.createCaller(createAuthedContext(1));
    await expect(owner.sharedWatchlists.members({ token: "tok123" })).resolves.toMatchObject({
      members: [{ userId: 2, role: "viewer", name: "Bob", email: "bob@example.com" }],
    });
  });

  // Phase 537: members-only shares (token alone is not sufficient) + the
  // "shared with me" list.
  it("gates a members-only share on membership", async () => {
    const sharedRows = [
      { ownerId: 1, token: "tok123", title: "T", expiresAt: null, membersOnly: true },
    ];
    // Non-member (even with the token) is refused.
    mockedGetDb.mockResolvedValue(fakeDb({ sharedRows, memberRows: [] }) as never);
    await expect(
      appRouter.createCaller(createAuthedContext(2)).sharedWatchlists.get({ token: "tok123" }),
    ).rejects.toThrow(/members-only/i);

    // Owner and invited members still see it.
    mockedGetDb.mockResolvedValue(fakeDb({ sharedRows }) as never);
    await expect(
      appRouter.createCaller(createAuthedContext(1)).sharedWatchlists.get({ token: "tok123" }),
    ).resolves.toMatchObject({ isOwner: true });

    mockedGetDb.mockResolvedValue(
      fakeDb({ sharedRows, memberRows: [{ userId: 2 }] }) as never,
    );
    await expect(
      appRouter.createCaller(createAuthedContext(2)).sharedWatchlists.get({ token: "tok123" }),
    ).resolves.toMatchObject({ isMember: true });
  });

  it("setMembersOnly is owner-only and echoes the value", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({ sharedRows: [{ ownerId: 1, token: "tok123", expiresAt: null }] }) as never,
    );
    await expect(
      appRouter
        .createCaller(createAuthedContext(1))
        .sharedWatchlists.setMembersOnly({ token: "tok123", membersOnly: true }),
    ).resolves.toMatchObject({ membersOnly: true });

    await expect(
      appRouter
        .createCaller(createAuthedContext(2))
        .sharedWatchlists.setMembersOnly({ token: "tok123", membersOnly: true }),
    ).rejects.toThrow(/not found/i);
  });

  it("listJoined returns member shares with the owner name", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        memberRows: [{ userId: 2, token: "live" }],
        sharedRows: [
          { ownerId: 1, token: "live", title: "Live", expiresAt: null, membersOnly: true },
        ],
      }) as never,
    );
    mockedGetUserById.mockResolvedValue({ id: 1, name: "Owner", email: "o@example.com" } as never);
    const res = await appRouter.createCaller(createAuthedContext(2)).sharedWatchlists.listJoined();
    expect(res.shares).toHaveLength(1);
    expect(res.shares[0]).toMatchObject({
      token: "live",
      title: "Live",
      ownerName: "Owner",
      membersOnly: true,
    });
  });

  it("listJoined drops an expired share", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        memberRows: [{ userId: 2, token: "dead" }],
        sharedRows: [
          {
            ownerId: 1,
            token: "dead",
            title: "Dead",
            expiresAt: new Date(Date.now() - 1000),
            membersOnly: false,
          },
        ],
      }) as never,
    );
    const res = await appRouter.createCaller(createAuthedContext(2)).sharedWatchlists.listJoined();
    expect(res.shares).toHaveLength(0);
  });

  it("get rejects an expired share", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [
          {
            ownerId: 1,
            token: "tok",
            title: "T",
            expiresAt: new Date(Date.now() - 1000),
          },
        ],
      }) as never,
    );
    await expect(
      appRouter
        .createCaller(createPublicContext())
        .sharedWatchlists.get({ token: "tok" }),
    ).rejects.toThrow(/expired/i);
  });

  it("members rejects an expired share", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [
          { ownerId: 2, token: "tok", expiresAt: new Date(Date.now() - 1000) },
        ],
      }) as never,
    );
    await expect(
      appRouter
        .createCaller(createAuthedContext(1))
        .sharedWatchlists.members({ token: "tok" }),
    ).rejects.toThrow(/expired/i);
  });

  it("inviteByEmail rejects an expired share for the owner", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [
          { ownerId: 1, token: "tok", expiresAt: new Date(Date.now() - 1000) },
        ],
      }) as never,
    );
    await expect(
      appRouter
        .createCaller(createAuthedContext(1))
        .sharedWatchlists.inviteByEmail({ token: "tok", email: "a@x.com" }),
    ).rejects.toThrow(/expired/i);
  });

  it("join rejects an expired share", async () => {
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [
          {
            ownerId: 2,
            token: "tok",
            expiresAt: new Date(Date.now() - 1000),
            membersOnly: false,
          },
        ],
      }) as never,
    );
    await expect(
      appRouter
        .createCaller(createAuthedContext(1))
        .sharedWatchlists.join({ token: "tok" }),
    ).rejects.toThrow(/expired/i);
  });

  it("leave removes the caller's membership", async () => {
    mockedGetDb.mockResolvedValue(fakeDb({}) as never);
    await expect(
      appRouter
        .createCaller(createAuthedContext(1))
        .sharedWatchlists.leave({ token: "tok" }),
    ).resolves.toEqual({ left: true });
  });
});
