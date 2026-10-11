import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function DiscoverScreen() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <Text style={{ color: colors.foreground }}>Discover — coming in Task 2</Text>
    </View>
  );
}
