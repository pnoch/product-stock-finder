import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function StockBadge({
  status,
  expectedDate,
}: {
  status: string;
  expectedDate?: string;
}) {
  const colors = useColors();
  const config: Record<string, { bg: string; text: string; label: string }> = {
    in_stock: {
      bg: colors.success + "22",
      text: colors.success,
      label: "In Stock",
    },
    back_order: {
      bg: colors.warning + "22",
      text: colors.warning,
      label: `Back Order${expectedDate ? ` · ${expectedDate}` : ""}`,
    },
    out_of_stock: {
      bg: colors.error + "22",
      text: colors.error,
      label: "Out of Stock",
    },
    unknown: { bg: colors.muted + "22", text: colors.muted, label: "Unknown" },
  };
  const c = config[status] ?? config.unknown;
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>
        ● {c.label}
      </Text>
    </View>
  );
}
