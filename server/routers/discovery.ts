import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
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

export const discoveryRouter = router({
  discover: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .mutation(async ({ input }) => {
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
        const parsed = JSON.parse(content);
        return {
          product: {
            id: `discovered-${Date.now()}`,
            name: parsed.product.name,
            modelNumber: parsed.product.modelNumber,
            brand: parsed.product.brand,
            category: parsed.product.category,
            description: parsed.product.description,
          },
          retailers: parsed.retailers.map((r: any, i: number) => ({
            id: `retailer-${Date.now()}-${i}`,
            name: r.name,
            website: r.website,
            country: r.country,
            currency: r.currency,
            region: "Global",
            countryFlag: "",
            paymentMethods: [],
            shippingCosts: {},
          })),
        };
      } catch {
        throw new Error("Failed to parse discovery response");
      }
    }),
});
