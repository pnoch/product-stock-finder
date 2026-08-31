import { View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function ProgressBar({
  progress,
  visible,
}: {
  progress: number;
  visible: boolean;
}) {
  const colors = useColors();

  if (!visible) return null;

  return (
    <View
      className="h-1 mx-4 mb-2 rounded-full overflow-hidden"
      style={{ backgroundColor: colors.primary + "20" }}
    >
      <View
        className="h-full rounded-full"
        style={{
          width: `${Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100}%`,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}
