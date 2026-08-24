import { describe, expect, it, vi } from "vitest";
import { parseProductText } from "../server/product-parse";

function llmReturning(content: string | null) {
  return vi.fn().mockResolvedValue({
    choices: content === null ? [] : [{ message: { content } }],
  });
}

describe("parseProductText", () => {
  it("extracts and trims fields from LLM JSON output", async () => {
    const llm = llmReturning(
      JSON.stringify({
        name: "  MikroTik CRS326 Switch ",
        modelNumber: "CRS326-24S+2Q+RM",
        brand: "MikroTik",
        category: "Networking Switch",
        description: "  24-port switch.  ",
      }),
    );
    const result = await parseProductText("crs326 switch 24 port", llm);
    expect(result).toEqual({
      name: "MikroTik CRS326 Switch",
      modelNumber: "CRS326-24S+2Q+RM",
      brand: "MikroTik",
      category: "Networking Switch",
      description: "24-port switch.",
    });
    expect(llm).toHaveBeenCalledOnce();
  });

  it("fills defaults for missing optional fields", async () => {
    const llm = llmReturning(
      JSON.stringify({ name: "Widget", modelNumber: "W-1" }),
    );
    const result = await parseProductText("widget w-1", llm);
    expect(result).toEqual({
      name: "Widget",
      modelNumber: "W-1",
      brand: "",
      category: "Other",
      description: "",
    });
  });

  it("returns null when name or modelNumber missing", async () => {
    const llm = llmReturning(JSON.stringify({ name: "No Model" }));
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("returns null on non-JSON LLM output", async () => {
    const llm = llmReturning("sure thing, here you go");
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    const llm = vi.fn().mockRejectedValue(new Error("no api key"));
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("truncates over-long fields", async () => {
    const llm = llmReturning(
      JSON.stringify({
        name: "N".repeat(300),
        modelNumber: "M".repeat(200),
        brand: "B".repeat(200),
        category: "C".repeat(200),
        description: "D".repeat(2000),
      }),
    );
    const result = (await parseProductText("x", llm))!;
    expect(result.name.length).toBe(200);
    expect(result.modelNumber.length).toBe(100);
    expect(result.brand.length).toBe(100);
    expect(result.category.length).toBe(100);
    expect(result.description.length).toBe(1000);
  });
});
