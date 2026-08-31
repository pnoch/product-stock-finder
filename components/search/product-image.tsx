import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchProductImage } from "@/lib/server-images";

export function ProductImage({ productId }: { productId: string }) {
  const colors = useColors();
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
  if (!imageUrl) {
    return (
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          marginRight: 12,
          backgroundColor: colors.border + "66",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <IconSymbol name="photo" size={20} color={colors.muted} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: imageUrl }}
      style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12, backgroundColor: colors.border }}
    />
  );
}
