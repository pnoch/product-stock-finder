import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("root layout mounts the webview fetch host", () => {
  const src = readFileSync(path.join(process.cwd(), "app/_layout.tsx"), "utf8");
  it("imports and renders WebViewFetchHost exactly once", () => {
    expect(src).toContain('from "@/components/webview-fetch-host"');
    expect(src.match(/<WebViewFetchHost \/>/g)?.length).toBe(1);
  });
});
