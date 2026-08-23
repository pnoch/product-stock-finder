import { useEffect, useState } from "react";
import { Image } from "react-native";
import { fetchProductImage } from "@/lib/server-images";

export function ProductImage({ productId }: { productId: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchProductImage(productId).then((res) => {
      if (active && res) setImageUrl(res.imageUrl);
    });
    return () => {
      active = false;
    };
  }, [productId]);
  if (!imageUrl) return null;
  return (
    <Image
      source={{ uri: imageUrl }}
      style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }}
    />
  );
}
