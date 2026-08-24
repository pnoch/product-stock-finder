import { invokeLLM, type InvokeParams } from "./_core/llm";

export interface ParsedProduct {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

type LlmInvoke = (params: InvokeParams) => Promise<{
  choices?: Array<{ message?: { content?: unknown } }>;
}>;

const LIMITS = {
  name: 200,
  modelNumber: 100,
  brand: 100,
  category: 100,
  description: 1000,
};

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

// Extracts a product template from messy free text. Returns null when the
// LLM is unavailable or its output is unusable — callers fall back to manual
// entry.
export async function parseProductText(
  raw: string,
  invoke: LlmInvoke = invokeLLM,
): Promise<ParsedProduct | null> {
  try {
    const result = await invoke({
      messages: [
        {
          role: "system",
          content:
            "You extract structured product data for an electronics stock tracker. " +
            "From the user's messy text (a model number, product name, or spec-sheet " +
            "paragraph), return ONLY a JSON object with keys: name (human-readable " +
            "product name), modelNumber (exact manufacturer model/part number — " +
            "preserve case and punctuation), brand, category (e.g. 'Networking " +
            "Switch', 'Router', 'Access Point'), description (1-2 factual sentences). " +
            "Never invent a model number; if the text contains none, omit it.",
        },
        { role: "user", content: raw.slice(0, 2000) },
      ],
      maxTokens: 400,
    });
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const jsonText = content.slice(
      content.indexOf("{"),
      content.lastIndexOf("}") + 1,
    );
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    const name = clean(parsed.name, LIMITS.name);
    const modelNumber = clean(parsed.modelNumber, LIMITS.modelNumber);
    if (!name || !modelNumber) return null;

    return {
      name,
      modelNumber,
      brand: clean(parsed.brand, LIMITS.brand),
      category: clean(parsed.category, LIMITS.category) || "Other",
      description: clean(parsed.description, LIMITS.description),
    };
  } catch {
    return null;
  }
}
