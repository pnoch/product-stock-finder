import { useEffect, useState, useCallback } from "react";
import { Image, View, Text, Animated } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchProductImage } from "@/lib/server-images";

const PLACEHOLDER_SIZE = 48;

function ImagePlaceholder({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: colors.border + "66",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
      accessibilityLabel="No image"
    >
      <IconSymbol name="photo" size={20} color={colors.muted} />
    </View>
  );
}

export function ProductImage({ productId, size = 48 }: { productId: string; size?: number }) {
  const colors = useColors();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const opacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    let active = true;
    setImageError(false);
    setLoaded(false);
    opacity.setValue(0);
    fetchProductImage(productId).then((res) => {
      if (active && res) setImageUrl(res.imageUrl);
      else if (active && !res) setImageUrl(null);
    });
    return () => {
      active = false;
    };
  }, [productId, opacity]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity]);

  const handleError = useCallback(() => {
    setImageError(true);
  }, []);

  if (!imageUrl || imageError) {
    if (size !== PLACEHOLDER_SIZE) {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            marginRight: 12,
            backgroundColor: colors.border + "66",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
          accessibilityLabel="No image"
        >
          <IconSymbol name="photo" size={Math.max(14, size * 0.42)} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 7, marginTop: 1 }} numberOfLines={1} ellipsizeMode="tail">
            No image
          </Text>
        </View>
      );
    }
    return <ImagePlaceholder colors={colors} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: colors.border + "66",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {!loaded && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.border + "66",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol name="photo" size={Math.max(14, size * 0.42)} color={colors.muted + "66"} />
        </View>
      )}
      <Animated.Image
        source={{ uri: imageUrl }}
        onLoad={handleLoad}
        onError={handleError}
        style={{ width: size, height: size, borderRadius: 8, opacity }}
        resizeMode="cover"
        accessibilityLabel="Product image"
      />
    </View>
  );
}
