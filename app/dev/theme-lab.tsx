import { View, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function ThemeLab() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Theme Lab</Text>
      <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>Developer playground for theme tokens. This is a stub.</Text>
    </View>
  );
}
