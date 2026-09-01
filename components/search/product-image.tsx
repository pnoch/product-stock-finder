import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchProductImage } from "@/lib/server-images";

const imageCache = new Map<string, string | null>();
const IMAGE_CACHE_MAX = 200;

function setImageCache(key: string, value: string | null) {
  if (imageCache.has(key)) imageCache.delete(key);
  else if (imageCache.size >= IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value as string | undefined;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  imageCache.set(key, value);
}

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
  const [imageUrl, setImageUrl] = useState<string | null>(() =>
    imageCache.has(productId) ? (imageCache.get(productId) ?? null) : null,
  );
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    setImageError(false);
    setLoaded(false);
    opacity.setValue(0);
    if (imageCache.has(productId)) {
      setImageUrl(imageCache.get(productId) ?? null);
      return () => {
        active = false;
      };
    }
    fetchProductImage(productId).then((res) => {
      const url = res?.imageUrl ?? null;
      if (url) setImageCache(productId, url);
      if (active) setImageUrl(url);
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
