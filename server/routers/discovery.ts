import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { invokeLLM } from "../_core/llm";

const DISCOVERY_PROMPT = `You are a product discovery assistant. Given a product search query, return a JSON object with:

1. "product": The product information
   - "name": Full product name
   - "modelNumber": Model/part number
   - "brand": Manufacturer brand
   - "category": Product category (e.g., "Headphones", "Laptop", "GPU", "Camera")
   - "description": 1-2 sentence description

2. "retailers": Array of 2-4 common retailers where this product is sold
   - "name": Retailer name
   - "website": Website URL
   - "country": Primary country
   - "currency": Currency code (USD, EUR, GBP, etc.)

Return ONLY valid JSON, no markdown fences.`;

function cleanStr(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function cleanUrl(value: unknown, max: number): string {
  const s = cleanStr(value, max);
  if (!/^https?:\/\/\S+$/i.test(s)) return "";
  return s;
}

export const discoveryRouter = router({
  discover: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      checkRateLimit(ctx, "discovery.discover", 10, 60_000);
      const prompt = `${DISCOVERY_PROMPT}\n\nSearch query: ${input.query}`;
      const result = await invokeLLM({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: input.query },
        ],
        maxTokens: 500,
      });

      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Invalid LLM response");
      }

      try {
        const parsed = JSON.parse(content) as {
          product?: Record<string, unknown>;
          retailers?: unknown;
        };
        const product = parsed.product ?? {};
        const name = cleanStr(product.name, 200);
        const modelNumber = cleanStr(product.modelNumber, 100);
        if (!name || !modelNumber) throw new Error("incomplete product");
        const retailers = Array.isArray(parsed.retailers)
          ? parsed.retailers.slice(0, 4)
          : [];
        return {
          product: {
            id: `discovered-${Date.now()}`,
            name,
            modelNumber,
            brand: cleanStr(product.brand, 100),
            category: cleanStr(product.category, 100),
            description: cleanStr(product.description, 1000),
          },
          retailers: retailers.map((r: unknown, i: number) => {
            const row =
              typeof r === "object" && r !== null
                ? (r as Record<string, unknown>)
                : {};
            return {
              id: `retailer-${Date.now()}-${i}`,
              name: cleanStr(row.name, 100),
              website: cleanUrl(row.website, 200),
              country: cleanStr(row.country, 100),
              currency: cleanStr(row.currency, 8),
              region: "Global",
              countryFlag: "",
              paymentMethods: [],
              shippingCosts: {},
            };
          }),
        };
      } catch {
        throw new Error("Failed to parse discovery response");
      }
    }),
});
