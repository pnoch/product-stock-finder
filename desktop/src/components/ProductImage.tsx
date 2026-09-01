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
  const [imageUrl, setImageUrl] = useState<string | null>(() =>
    imageCache.has(productId) ? (imageCache.get(productId) ?? null) : null,
  );
  const [loading, setLoading] = useState(() => !imageCache.has(productId));
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
    if (imageCache.has(productId)) {
      setImageUrl(imageCache.get(productId)!);
      setLoading(false);
      return;
    }
    let active = true;
    const base = getApiBaseUrl();
    if (!base) {
      setLoading(false);
      return;
    }
    setLoading(true);
    invoke<{ imageUrl?: string }>("fetch_product_image", {
      apiBaseUrl: base,
      productId,
    })
      .then((res) => {
        const url = res?.imageUrl ?? null;
        imageCache.set(productId, url);
        if (active) {
          setImageUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        imageCache.set(productId, null);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          marginRight: 10,
        }}
        className="shrink-0 skeleton-shimmer rounded-lg"
      />
    );
  }

  if (!imageUrl || imgError) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          marginRight: 10,
        }}
        className="shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600"
        title="No image"
      >
        <span className="text-[10px] text-gray-400 text-center leading-none">No image</span>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size, marginRight: 10 }}
      className="shrink-0 relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
    >
      {!imgLoaded && <div className="absolute inset-0 skeleton-shimmer rounded-lg" aria-hidden="true" />}
      <img
        src={imageUrl}
        alt={productId}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          objectFit: "cover",
          opacity: imgLoaded ? 1 : 0,
          transition: "opacity 220ms ease",
        }}
        className="shrink-0"
        loading="lazy"
      />
    </div>
  );
}
