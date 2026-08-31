import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getApiBaseUrl } from "../lib/api-base";

const imageCache = new Map<string, string | null>();

export function ProductImage({
  productId,
  size = 48,
}: {
  productId: string;
  size?: number;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (imageCache.has(productId)) {
      setImageUrl(imageCache.get(productId)!);
      return;
    }
    let active = true;
    const base = getApiBaseUrl();
    if (!base) return;
    invoke<{ imageUrl?: string }>("fetch_product_image", {
      apiBaseUrl: base,
      productId,
    })
      .then((res) => {
        const url = res?.imageUrl ?? null;
        imageCache.set(productId, url);
        if (active && url) setImageUrl(url);
      })
      .catch(() => {
        imageCache.set(productId, null);
      });
    return () => {
      active = false;
    };
  }, [productId]);
  if (!imageUrl) return null;
  return (
    <img
      src={imageUrl}
      alt=""
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        marginRight: 10,
        objectFit: "cover",
      }}
    />
  );
}
