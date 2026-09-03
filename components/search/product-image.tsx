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

// ─── Concurrency-limited loader (max 3 in-flight) with idle deferral ───
const MAX_CONCURRENT_IMAGE_FETCHES = 3;
let activeImageFetches = 0;
type QueuedTask = () => void;
const imageQueue: QueuedTask[] = [];

function scheduleIdle(cb: () => void) {
  const g = globalThis as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (typeof g.requestIdleCallback === "function") {
    g.requestIdleCallback(cb, { timeout: 800 });
  } else {
    setTimeout(cb, 32);
  }
}

function drainImageQueue() {
  while (activeImageFetches < MAX_CONCURRENT_IMAGE_FETCHES && imageQueue.length > 0) {
    const task = imageQueue.shift()!;
    activeImageFetches += 1;
    scheduleIdle(task);
  }
}

function enqueueImageFetch(task: QueuedTask) {
  imageQueue.push(task);
  drainImageQueue();
}

function dequeueImageFetchOnComplete() {
  activeImageFetches = Math.max(0, activeImageFetches - 1);
  drainImageQueue();
}

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
    let queued = false;
    let taskRef: QueuedTask | null = null;
    setImageError(false);
    setLoaded(false);
    opacity.setValue(0);
    if (imageCache.has(productId)) {
      setImageUrl(imageCache.get(productId) ?? null);
      return () => {
        active = false;
      };
    }
    const run = () => {
      queued = false;
      if (!active) {
        dequeueImageFetchOnComplete();
        return;
      }
      fetchProductImage(productId)
        .then((res) => {
          const url = res?.imageUrl ?? null;
          setImageCache(productId, url);
          if (active) setImageUrl(url);
        })
        .catch(() => {
          if (active) setImageCache(productId, null);
        })
        .finally(() => {
          dequeueImageFetchOnComplete();
        });
    };
    taskRef = run;
    if (activeImageFetches < MAX_CONCURRENT_IMAGE_FETCHES) {
      activeImageFetches += 1;
      scheduleIdle(run);
      queued = true;
    } else {
      enqueueImageFetch(run);
      queued = true;
    }
    return () => {
      active = false;
      if (queued && taskRef) {
        const idx = imageQueue.indexOf(taskRef);
        if (idx !== -1) imageQueue.splice(idx, 1);
      }
    };
  }, [productId, opacity]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity]);

  const handleError = useCallback(() => {
    setImageCache(productId, null);
    setImageError(true);
  }, [productId]);

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
