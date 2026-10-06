import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { setOnboardingSeen } from "@/lib/onboarding";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CountryPicker } from "@/components/ui/country-picker";
import { updateSettings } from "@/lib/storage";
import { getCountry } from "@shared/countries";

function localeRegion(): string | null {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    const region = new Intl.Locale(locale).region;
    return region && getCountry(region) ? region : null;
  } catch {
    return null;
  }
}

// Icons, not emoji: emoji glyphs depend on a system emoji font, which is absent
// on many Linux desktops and renders as an empty "tofu" box in the tour.
const SLIDES = [
  {
    icon: "cart.fill",
    title: "Find It Anywhere",
    body: "One search across 25 global distributors — see who actually has it in stock.",
  },
  {
    icon: "sparkles",
    title: "Know the Real Price",
    body: "Landed cost to your country: price + shipping + tax, ranked. No surprises at checkout.",
  },
  {
    icon: "bell",
    title: "Never Miss a Restock",
    body: "Price alerts, restock watches, and digests tell you the second it's back or cheaper.",
  },
] as const;

export function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<"slides" | "destination">("slides");
  const [country, setCountry] = useState<string | null>(localeRegion);
  const [taxExempt, setTaxExempt] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const finish = async () => {
    await setOnboardingSeen();
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const finishDestination = async () => {
    await updateSettings({
      ...(country
        ? {
            shipToCountry: country,
            displayCurrency: getCountry(country)?.currency ?? undefined,
          }
        : {}),
      taxExempt,
    });
    await finish();
  };

  const goNext = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      setStep("destination");
    }
  };

  if (step === "destination") {
    const selected = country ? getCountry(country) : undefined;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 26,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Where do you ship to?
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 15,
              textAlign: "center",
              marginTop: 10,
              lineHeight: 22,
            }}
          >
            We use this to estimate landed cost and show prices in your local
            currency.
          </Text>

          <Pressable
            onPress={() => setPickerVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              paddingVertical: 15,
              paddingHorizontal: 16,
              marginTop: 28,
            }}
            accessibilityLabel="Choose shipping country"
            accessibilityRole="button"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <IconSymbol name="globe" size={20} color={colors.primary} />
              <Text
                style={{
                  color: selected ? colors.foreground : colors.muted,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {selected ? selected.name : "Choose country"}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 15,
                flex: 1,
                marginRight: 12,
              }}
            >
              I&apos;m tax-exempt (VAT/EORI)
            </Text>
            <Switch
              value={taxExempt}
              onValueChange={setTaxExempt}
              trackColor={{ false: colors.border, true: colors.primary + "88" }}
              thumbColor={taxExempt ? colors.primary : colors.muted}
              accessibilityLabel="I'm tax-exempt"
              accessibilityRole="switch"
            />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => void finishDestination()}
          style={{
            marginHorizontal: 32,
            marginBottom: 16,
            paddingVertical: 15,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
          }}
          accessibilityLabel="Finish"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Finish
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => void finish()}
          style={{ alignItems: "center", marginBottom: 48, padding: 8 }}
          accessibilityLabel="Skip"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.muted, fontSize: 14 }}>Skip</Text>
        </TouchableOpacity>

        <CountryPicker
          visible={pickerVisible}
          value={country ?? undefined}
          onSelect={(code) => {
            setCountry(code);
            setPickerVisible(false);
          }}
          onClose={() => setPickerVisible(false)}
        />
      </View>
    );
  }

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
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 24,
                backgroundColor: colors.primary + "18",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSymbol name={item.icon} size={44} color={colors.primary} />
            </View>
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
