import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getApiBaseUrl } from "../lib/api-base";

export function ProductImage({
  productId,
  size = 48,
}: {
  productId: string;
  size?: number;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const base = getApiBaseUrl();
    if (!base) return;
    invoke<{ imageUrl?: string }>("fetch_product_image", {
      apiBaseUrl: base,
      productId,
    })
      .then((res) => {
        if (active && res && res.imageUrl) setImageUrl(res.imageUrl);
      })
      .catch(() => {});
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
