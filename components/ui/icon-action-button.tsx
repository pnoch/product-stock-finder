import { TouchableOpacity } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

type IconActionButtonProps = {
  name: Parameters<typeof IconSymbol>[0]["name"];
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  size?: number;
};

/**
 * A 44x44 icon button. Uses a real touch target instead of `hitSlop`, because
 * `hitSlop` is measured in dp and expands past neighbouring buttons — stacked
 * actions (edit/snooze/delete) then overlap and the last-rendered one swallows
 * every tap, making the earlier buttons unreachable.
 */
export function IconActionButton({
  name,
  color,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = 16,
}: IconActionButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        minHeight: 44,
        minWidth: 44,
        justifyContent: "center",
        alignItems: "center",
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
    >
      <IconSymbol name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}
