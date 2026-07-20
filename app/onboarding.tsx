import { useState } from "react";
import { View, Text, TouchableOpacity, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/hooks/use-colors";
import { markOnboardingComplete } from "@/lib/storage";
import { IconSymbol } from "@/components/ui/icon-symbol";

const { width } = Dimensions.get("window");

const STEPS = [
  {
    icon: "magnifyingglass" as const,
    title: "Find Any Product",
    description: "Search our catalog of networking gear, NICs, gateways, and more. Add any product to your personal watchlist in one tap.",
    gradient: ["#0a7ea4", "#005f7a"] as [string, string],
  },
  {
    icon: "list.bullet" as const,
    title: "Track Availability",
    description: "See real-time stock status and prices across 10+ global distributors. Filter by region to find the best local option.",
    gradient: ["#0559C9", "#033a8a"] as [string, string],
  },
  {
    icon: "bell.fill" as const,
    title: "Get Notified",
    description: "Set a target price and get a push notification the moment a distributor drops below it. Never miss a deal again.",
    gradient: ["#22C55E", "#15803d"] as [string, string],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = useColors();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      await markOnboardingComplete();
      router.replace("/(tabs)" as any);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = async () => {
    await markOnboardingComplete();
    router.replace("/(tabs)" as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={current.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      >
        {/* Skip */}
        <TouchableOpacity
          onPress={handleSkip}
          style={{ position: "absolute", top: 56, right: 24, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Skip</Text>
        </TouchableOpacity>

        {/* Icon */}
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          <IconSymbol name={current.icon} size={48} color="#fff" />
        </View>

        {/* Text */}
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
          {current.title}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, textAlign: "center", lineHeight: 24 }}>
          {current.description}
        </Text>

        {/* Step dots */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 48, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? "#fff" : "rgba(255,255,255,0.4)" }}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <TouchableOpacity
          onPress={handleNext}
          style={{ backgroundColor: "#fff", borderRadius: 28, paddingHorizontal: 40, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Text style={{ color: current.gradient[0], fontWeight: "700", fontSize: 16 }}>
            {isLast ? "Get Started" : "Next"}
          </Text>
          {!isLast && <IconSymbol name="chevron.right" size={16} color={current.gradient[0]} />}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

