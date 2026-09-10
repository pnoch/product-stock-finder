import { describe, expect, it } from "vitest";
import {
  getProductNote,
  saveProductNote,
  type KeyValueStore,
} from "../lib/product-notes";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("product notes", () => {
  it("returns empty string when no note exists", async () => {
    const store = memoryStore();
    expect(await getProductNote("p1", store)).toBe("");
  });

  it("saves and round-trips a note", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "Wait for restock at MikroTik Store", store);
    expect(await getProductNote("p1", store)).toBe(
      "Wait for restock at MikroTik Store",
    );
  });

  it("trims whitespace on save", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "  note  ", store);
    expect(await getProductNote("p1", store)).toBe("note");
  });

  it("removes the entry when saving an empty note", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "note", store);
    await saveProductNote("p1", "   ", store);
    const raw = JSON.parse(store.data.get("product_notes")!);
    expect(raw.p1).toBeUndefined();
    expect(await getProductNote("p1", store)).toBe("");
  });

  it("keeps other products' notes intact", async () => {
    const store = memoryStore();
    await saveProductNote("p1", "one", store);
    await saveProductNote("p2", "two", store);
    expect(await getProductNote("p1", store)).toBe("one");
    expect(await getProductNote("p2", store)).toBe("two");
  });

  it("tolerates corrupt stored JSON", async () => {
    const store = memoryStore({ product_notes: "{not json" });
    expect(await getProductNote("p1", store)).toBe("");
  });

  it("propagates persistence failures instead of swallowing them", async () => {
    const store = memoryStore();
    store.setItem = async () => {
      throw new Error("disk full");
    };
    await expect(saveProductNote("p1", "note", store)).rejects.toThrow("disk full");
  });
});
