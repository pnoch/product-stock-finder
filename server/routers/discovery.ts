import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { tryConsumeBudget } from "../spend-budget";
import {
  UserLlmAuthError,
  invokeUserLlm,
  userLlmConfigFromHeaders,
} from "../user-llm";
import { BYO_LLM_AUTH_ERR_MSG } from "../../shared/const.js";

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
      // BYO-LLM: when the device has configured its own provider the call is
      // user-funded, so the process-wide spend budget (which guards the
      // operator's paid provider) does not apply.
      const userLlm = userLlmConfigFromHeaders(ctx.req.headers);
      // Process-wide cap: per-user rate limits don't bound total provider spend.
      if (!userLlm && !tryConsumeBudget("discovery.discover")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Discovery is temporarily unavailable. Try again later.",
        });
      }
      const prompt = `${DISCOVERY_PROMPT}\n\nSearch query: ${input.query}`;
      let result: Awaited<ReturnType<typeof invokeUserLlm>>;
      try {
        result = await invokeUserLlm(userLlm, {
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: input.query },
          ],
          maxTokens: 500,
        });
      } catch (e) {
        // A rejected BYO key is actionable (fix it in Settings), so return a
        // non-auth status the client can map to "check your API key" — using
        // 401/403 would be mistaken for "sign in required".
        if (e instanceof UserLlmAuthError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: BYO_LLM_AUTH_ERR_MSG,
          });
        }
        throw e;
      }

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
