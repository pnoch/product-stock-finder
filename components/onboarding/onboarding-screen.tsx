import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { setOnboardingSeen } from "@/lib/onboarding";

const SLIDES = [
  {
    emoji: "🛒",
    title: "Track Prices Everywhere",
    body: "Monitor products across 25 global distributors in one watchlist.",
  },
  {
    emoji: "✨",
    title: "Add Anything",
    body: "Search the catalog, paste a list of model numbers, or add any product manually with AI.",
  },
  {
    emoji: "🔔",
    title: "Never Miss a Drop",
    body: "Price alerts, restock watches, and weekly digests keep you ahead.",
  },
];

export function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    await setOnboardingSeen();
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const goNext = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      void finish();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity activeOpacity={0.7}
        onPress={() => void finish()}
        style={{
          position: "absolute",
          top: insets.top + 12,
          right: 20,
          zIndex: 1,
          padding: 8,
        }}
        accessibilityLabel="Skip onboarding"
        accessibilityRole="button"
      >
        <Text style={{ color: colors.muted, fontSize: 14 }}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / Dimensions.get("window").width))
        }
        renderItem={({ item }) => (
          <View
            style={{
              width: Dimensions.get("window").width,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 40,
            }}
          >
            <Text style={{ fontSize: 72 }}>{item.emoji}</Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 24,
                fontWeight: "700",
                textAlign: "center",
                marginTop: 20,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                textAlign: "center",
                marginTop: 12,
                lineHeight: 22,
              }}
            >
              {item.body}
            </Text>
          </View>
        )}
        keyExtractor={(_, i) => String(i)}
      />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginBottom: 24,
        }}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.85}
        onPress={goNext}
        style={{
          marginHorizontal: 32,
          marginBottom: 48,
          paddingVertical: 15,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center",
        }}
        accessibilityLabel={index === SLIDES.length - 1 ? "Get Started" : "Next"}
        accessibilityRole="button"
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
          {index === SLIDES.length - 1 ? "Get Started" : "Next"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
