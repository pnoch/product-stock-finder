import { eq } from "drizzle-orm";
import { productImages } from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../lib/catalog";
import { getDb } from "./db";
import { generateImage } from "./_core/imageGeneration";

type CatalogProduct = (typeof PRODUCT_CATALOG)[number];

const memoryImages = new Map<string, string>();
const inFlight = new Map<string, Promise<ProductImage | null>>();

export interface ProductImage {
  imageUrl: string;
}

export async function getProductImage(
  productId: string,
): Promise<ProductImage | null> {
  const existing = inFlight.get(productId);
  if (existing) return existing;

  const promise = getProductImageInner(productId);
  inFlight.set(productId, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(productId);
  }
}

async function getProductImageInner(
  productId: string,
): Promise<ProductImage | null> {
  const cached = await readCached(productId);
  if (cached) return { imageUrl: cached };
  const product = PRODUCT_CATALOG.find((p) => p.id === productId);
  if (!product) return null;
  const url = await generateImageForProduct(product);
  if (!url) return null;
  await writeCached(productId, url);
  return { imageUrl: url };
}

async function readCached(productId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) {
    return memoryImages.get(productId) ?? null;
  }
  const rows = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .limit(1);
  return rows.length > 0 ? rows[0]!.imageUrl : null;
}

async function writeCached(productId: string, url: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryImages.set(productId, url);
    return;
  }
  await db
    .insert(productImages)
    .values({ productId, imageUrl: url })
    .onDuplicateKeyUpdate({ set: { imageUrl: url } });
}

function buildImagePrompt(product: {
  name: string;
  category: string;
}): string {
  return `A ${product.name} ${product.category.toLowerCase()}, product photo, clean background, high detail`;
}

async function generateImageForProduct(
  product: CatalogProduct,
): Promise<string | null> {
  try {
    const result = await generateImage({ prompt: buildImagePrompt(product) });
    return result.url ?? null;
  } catch {
    return null;
  }
}

export async function listProductsMissingImage(): Promise<string[]> {
  const missing: string[] = [];
  for (const product of PRODUCT_CATALOG) {
    const cached = await readCached(product.id);
    if (!cached) missing.push(product.id);
  }
  return missing;
}

export function clearImagesForTests(): void {
  memoryImages.clear();
  inFlight.clear();
}
