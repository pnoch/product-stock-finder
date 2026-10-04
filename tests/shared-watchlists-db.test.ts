import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sharedWatchlistMembers, sharedWatchlists, users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { sharedWatchlistsRouter } from "../server/routers/shared-watchlists";
import { clearRateLimitsForTests } from "../server/rate-limit";
import type { TrpcContext } from "../server/_core/context";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

function ctxFor(id: number, tag: string): TrpcContext {
  return {
    user: {
      id,
      openId: `u-${tag}`,
      name: tag,
      email: `${tag}@example.com`,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip: `10.0.0.${id % 250}`,
      socket: { remoteAddress: `10.0.0.${id % 250}` },
    } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}

let seed = 0;
async function seedUser(tag: string) {
  const db = await getDb();
  const run = `${Date.now()}-${(seed += 1)}-${Math.random().toString(36).slice(2, 8)}`;
  const openId = `shared-${tag}-${run}`;
  const email = `shared-${tag}-${run}@example.com`;
  await db!.insert(users).values({ openId, email, name: tag });
  const [row] = await db!
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  const id = row!.id;
  return { id, email, caller: sharedWatchlistsRouter.createCaller(ctxFor(id, tag)) };
}

/** Inserts a share directly so expiry/members-only state can be set exactly. */
async function seedShare(ownerId: number, overrides: Partial<{ expiresAt: Date; membersOnly: boolean }> = {}) {
  const db = await getDb();
  const token = `tok-${Date.now()}-${(seed += 1)}-${Math.random().toString(36).slice(2, 8)}`;
  await db!.insert(sharedWatchlists).values({
    ownerId,
    token,
    title: "Shared",
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
    membersOnly: overrides.membersOnly ?? false,
  });
  return token;
}

describe.skipIf(!runDbTests)("shared watchlists router (DB)", () => {
  beforeEach(() => clearRateLimitsForTests());
  afterEach(() => clearRateLimitsForTests());

  it("get rejects an unknown token and an expired share (deleting it)", async () => {
    const owner = await seedUser("owner");
    await expect(owner.caller.get({ token: "does-not-exist" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const expired = await seedShare(owner.id, { expiresAt: new Date(Date.now() - 1000) });
    await expect(owner.caller.get({ token: expired })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Expired shares are cleaned up on read.
    const db = await getDb();
    const rows = await db!
      .select({ token: sharedWatchlists.token })
      .from(sharedWatchlists)
      .where(eq(sharedWatchlists.token, expired));
    expect(rows).toHaveLength(0);
  });

  it("create returns a share and get reports owner/member flags", async () => {
    const owner = await seedUser("owner");
    const created = await owner.caller.create({ title: "Mine" });
    expect(created.token).toBeTruthy();
    expect(created.shareUrl).toContain(`/w/${created.token}`);
    const view = await owner.caller.get({ token: created.token });
    expect(view.title).toBe("Mine");
    expect(view.isOwner).toBe(true);
    expect(view.isMember).toBe(false);
  });

  it("members-only: outsider forbidden, owner and invited member allowed", async () => {
    const owner = await seedUser("owner");
    const member = await seedUser("member");
    const outsider = await seedUser("outsider");
    const token = await seedShare(owner.id, { membersOnly: true });

    await expect(outsider.caller.get({ token })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.caller.get({ token })).resolves.toMatchObject({ isOwner: true });

    await owner.caller.inviteByEmail({ token, email: member.email });
    await expect(member.caller.get({ token })).resolves.toMatchObject({ isMember: true });
  });

  it("members returns the roster with names, and rejects non-members/unknown tokens", async () => {
    const owner = await seedUser("owner");
    const member = await seedUser("member");
    const outsider = await seedUser("outsider");
    const token = await seedShare(owner.id);

    await expect(owner.caller.members({ token: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(outsider.caller.members({ token })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await owner.caller.inviteByEmail({ token, email: member.email });
    const roster = await owner.caller.members({ token });
    expect(roster.members.map((m) => m.userId)).toContain(member.id);
    expect(roster.members[0]!.name).toBe("member");
  });

  it("hides member emails from non-owner members but keeps names", async () => {
    const owner = await seedUser("owner");
    const memberA = await seedUser("membera");
    const memberB = await seedUser("memberb");
    const token = await seedShare(owner.id);
    await owner.caller.inviteByEmail({ token, email: memberA.email });
    await owner.caller.inviteByEmail({ token, email: memberB.email });

    const ownerView = await owner.caller.members({ token });
    expect(ownerView.members.map((m) => m.email)).toContain(memberA.email);

    const memberView = await memberA.caller.members({ token });
    expect(memberView.members.length).toBeGreaterThan(0);
    expect(memberView.members.every((m) => m.email === null)).toBe(true);
    expect(memberView.members.some((m) => m.name === "memberb")).toBe(true);
  });

  it("invite rejects unknown tokens, non-owners, and unknown user ids", async () => {
    const owner = await seedUser("owner");
    const outsider = await seedUser("outsider");
    const target = await seedUser("target");
    const token = await seedShare(owner.id);

    await expect(owner.caller.invite({ token: "nope", userId: target.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // A share the caller does not own is rejected with FORBIDDEN.
    await expect(outsider.caller.invite({ token, userId: target.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Unknown user id -> FK error mapped to NOT_FOUND, not INTERNAL_SERVER_ERROR.
    await expect(owner.caller.invite({ token, userId: 2_000_000_000 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("inviteByEmail rejects non-owners, unknown accounts, self, and expired shares", async () => {
    const owner = await seedUser("owner");
    const outsider = await seedUser("outsider");
    const member = await seedUser("member");
    const token = await seedShare(owner.id);

    await expect(outsider.caller.inviteByEmail({ token, email: member.email })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(owner.caller.inviteByEmail({ token, email: "ghost@example.com" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(owner.caller.inviteByEmail({ token, email: owner.email })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    const expired = await seedShare(owner.id, { expiresAt: new Date(Date.now() - 1000) });
    await expect(owner.caller.inviteByEmail({ token: expired, email: member.email })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("removeMember requires ownership and removes the roster entry", async () => {
    const owner = await seedUser("owner");
    const outsider = await seedUser("outsider");
    const member = await seedUser("member");
    const token = await seedShare(owner.id);
    await owner.caller.inviteByEmail({ token, email: member.email });

    await expect(outsider.caller.removeMember({ token, userId: member.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(owner.caller.removeMember({ token, userId: member.id })).resolves.toEqual({
      removed: true,
    });
    const roster = await owner.caller.members({ token });
    expect(roster.members).toHaveLength(0);
  });

  it("join rejects unknown/expired shares and gates members-only shares", async () => {
    const owner = await seedUser("owner");
    const member = await seedUser("member");
    const token = await seedShare(owner.id);

    await expect(member.caller.join({ token: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const expired = await seedShare(owner.id, { expiresAt: new Date(Date.now() - 1000) });
    await expect(member.caller.join({ token: expired })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // An open (non-members-only) share joins freely.
    await expect(member.caller.join({ token })).resolves.toEqual({ joined: true });

    const inviteOnly = await seedShare(owner.id, { membersOnly: true });
    await expect(member.caller.join({ token: inviteOnly })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await owner.caller.inviteByEmail({ token: inviteOnly, email: member.email });
    await expect(member.caller.join({ token: inviteOnly })).resolves.toEqual({ joined: true });
  });

  it("join + leave update membership and listJoined", async () => {
    const owner = await seedUser("owner");
    const member = await seedUser("member");
    const token = await seedShare(owner.id);

    await member.caller.join({ token });
    const afterJoin = await member.caller.get({ token });
    expect(afterJoin.isMember).toBe(true);
    const joined = await member.caller.listJoined();
    expect(joined.shares.map((s) => s.token)).toContain(token);

    await member.caller.leave({ token });
    const afterLeave = await member.caller.get({ token });
    expect(afterLeave.isMember).toBe(false);
  });

  it("listJoined drops expired shares and orphaned memberships", async () => {
    const owner = await seedUser("owner");
    const member = await seedUser("member");
    const live = await seedShare(owner.id);
    const expired = await seedShare(owner.id, { expiresAt: new Date(Date.now() - 1000) });
    await member.caller.join({ token: live });
    // Seed the expired membership directly: `join` correctly refuses an expired
    // share, so a stale membership is the state the list must tolerate (e.g. the
    // share expired after the member joined).
    const db = await getDb();
    await db!
      .insert(sharedWatchlistMembers)
      .values({ token: expired, userId: member.id, role: "viewer" });

    const joined = await member.caller.listJoined();
    const tokens = joined.shares.map((s) => s.token);
    expect(tokens).toContain(live);
    expect(tokens).not.toContain(expired);
  });

  it("setMembersOnly and extend require ownership", async () => {
    const owner = await seedUser("owner");
    const outsider = await seedUser("outsider");
    const token = await seedShare(owner.id);

    await expect(outsider.caller.setMembersOnly({ token, membersOnly: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(owner.caller.setMembersOnly({ token, membersOnly: true })).resolves.toEqual({
      membersOnly: true,
    });
    await expect(outsider.caller.extend({ token })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const extended = await owner.caller.extend({ token });
    expect(new Date(extended.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("revoke only removes the caller's own share", async () => {
    const owner = await seedUser("owner");
    const other = await seedUser("other");
    const mine = await seedShare(owner.id);
    const theirs = await seedShare(other.id);

    await owner.caller.revoke({ token: theirs });
    // The other owner's share survives.
    await expect(other.caller.get({ token: theirs })).resolves.toMatchObject({ token: theirs });

    await owner.caller.revoke({ token: mine });
    await expect(owner.caller.get({ token: mine })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("list returns the caller's shares only", async () => {
    const owner = await seedUser("owner");
    const other = await seedUser("other");
    const mine = await seedShare(owner.id);
    await seedShare(other.id);

    const listed = await owner.caller.list();
    expect(listed.links.map((l) => l.token)).toEqual([mine]);
  });
});
