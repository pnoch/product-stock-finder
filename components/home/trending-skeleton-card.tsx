import { View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SkeletonBox } from "@/components/ui/skeleton";

export function TrendingSkeletonCard() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <SkeletonBox width={40} height={40} borderRadius={8} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="68%" height={14} borderRadius={6} />
          <SkeletonBox width="42%" height={11} borderRadius={6} />
          <SkeletonBox width="52%" height={11} borderRadius={6} />
        </View>
        <SkeletonBox width={54} height={28} borderRadius={8} />
      </View>
    </View>
  );
}
