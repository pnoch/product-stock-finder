import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("auth hardening invariants", () => {
  it("bounds auth rate-limit buckets through the shared capped limiter", () => {
    const src = read("server/_core/oauth.ts");
    // The local Map had no cap: a burst of unique keys (attacker-supplied
    // emails on /forgot) grew it without bound and made the prune O(n) per
    // request. The shared limiter caps + LRUs its buckets.
    expect(src).toContain("checkRateLimitByKey(");
    expect(src).not.toContain("const authBuckets = new Map");
  });

  it("pins the Apple id_token algorithm", () => {
    const src = read("server/_core/oauth.ts");
    const verify = src.slice(
      src.indexOf("jwtVerify(tokenData.id_token"),
      src.indexOf("const sub = payload.sub"),
    );
    expect(verify).toContain('algorithms: ["RS256"]');
  });

  it("compares against a dummy hash so login latency does not leak account existence", () => {
    expect(read("server/_core/sdk.ts")).toContain(
      "await bcrypt.compare(req.password, dummyPasswordHash())",
    );
  });
});
