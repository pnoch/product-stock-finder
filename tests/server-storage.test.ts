import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  forgeUrl: "https://forge.example.com///",
  forgeKey: "forge-secret",
}));

vi.mock("../server/_core/env", () => ({
  ENV: {
    get forgeApiUrl() {
      return state.forgeUrl;
    },
    get forgeApiKey() {
      return state.forgeKey;
    },
  },
}));

const fetchWithTimeout = vi.hoisted(() => vi.fn());
vi.mock("../server/fetch-timeout", () => ({
  fetchWithTimeout: (...a: unknown[]) =>
    fetchWithTimeout(...(a as Parameters<typeof fetchWithTimeout>)),
}));

import { storagePut } from "../server/storage";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.forgeUrl = "https://forge.example.com///";
  state.forgeKey = "forge-secret";
  vi.stubGlobal("crypto", {
    randomUUID: () => "12345678-0000-0000-0000-000000000000",
  });
});

describe("storagePut", () => {
  it("presigns then uploads and returns a hashed /storage path", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse({ url: "https://s3.example.com/put" }))
      .mockResolvedValueOnce(jsonResponse({}, true, 200));

    const result = await storagePut("/avatars/me.png", "hello", "image/png");

    expect(result.key).toBe("avatars/me_12345678.png");
    expect(result.url).toBe("/storage/avatars/me_12345678.png");

    const [presignUrl, presignInit] = fetchWithTimeout.mock.calls[0]!;
    const url = presignUrl as URL;
    expect(url.origin + url.pathname).toBe(
      "https://forge.example.com/v1/storage/presign/put",
    );
    expect(url.searchParams.get("path")).toBe("avatars/me_12345678.png");
    expect(
      (presignInit as RequestInit).headers as Record<string, string>,
    ).toMatchObject({ Authorization: "Bearer forge-secret" });

    const [uploadUrl, uploadInit] = fetchWithTimeout.mock.calls[1]!;
    expect(uploadUrl).toBe("https://s3.example.com/put");
    expect((uploadInit as RequestInit).method).toBe("PUT");
    expect(
      ((uploadInit as RequestInit).headers as Record<string, string>)[
        "Content-Type"
      ],
    ).toBe("image/png");
    expect((uploadInit as RequestInit).body).toBeInstanceOf(Blob);
  });

  it("appends the hash suffix when the key has no extension", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse({ url: "https://s3.example.com/put" }))
      .mockResolvedValueOnce(jsonResponse({}));
    const result = await storagePut("LICENSE", Buffer.from("x"));
    expect(result.key).toBe("LICENSE_12345678");
  });

  it("throws when the storage config is missing", async () => {
    state.forgeUrl = "";
    await expect(storagePut("k", "v")).rejects.toThrow(/config missing/);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it("throws when presign is not ok", async () => {
    fetchWithTimeout.mockResolvedValueOnce(
      jsonResponse({ error: "nope" }, false, 403),
    );
    await expect(storagePut("k", "v")).rejects.toThrow(/presign failed \(403\)/);
  });

  it("throws when Forge returns an empty presign URL", async () => {
    fetchWithTimeout.mockResolvedValueOnce(jsonResponse({ url: "" }));
    await expect(storagePut("k", "v")).rejects.toThrow(/empty presign URL/);
  });

  it("throws when the S3 upload fails", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse({ url: "https://s3.example.com/put" }))
      .mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(storagePut("k", "v")).rejects.toThrow(
      /upload to S3 failed \(500\)/,
    );
  });
});
