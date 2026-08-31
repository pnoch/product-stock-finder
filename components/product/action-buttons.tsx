import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAlert } from "@/lib/alert";

interface ActionButtonsProps {
  onSetAlert: () => void;
  isRefreshingAny: boolean;
  onRefresh: () => Promise<boolean>;
  onShare: () => void;
  onTestStockNotification: () => void;
  onCopyLink: () => void;
  onCompare: () => void;
}

export function ActionButtons({
  onSetAlert,
  isRefreshingAny,
  onRefresh,
  onShare,
  onTestStockNotification,
  onCopyLink,
  onCompare,
}: ActionButtonsProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <>
      {/* Primary Action Buttons */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 16,
          gap: 10,
          marginBottom: 20,
        }}
      >
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSetAlert();
          }}
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 13,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
          accessibilityLabel="Set price alert"
          accessibilityRole="button"
        >
          <IconSymbol name="bell.fill" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            Set Price Alert
          </Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          disabled={isRefreshingAny}
          onPress={async () => {
            if (isRefreshingAny) return;
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const ok = await onRefresh();
            if (!ok) {
              showAlert(
                "Couldn't refresh prices",
                "The server is unreachable. Showing saved prices.",
              );
            }
          }}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            paddingVertical: 13,
            paddingHorizontal: 16,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            gap: 6,
            opacity: isRefreshingAny ? 0.5 : 1,
          }}
          accessibilityLabel="Refresh prices"
          accessibilityRole="button"
        >
          {isRefreshingAny ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <IconSymbol
              name="arrow.clockwise"
              size={16}
              color={colors.foreground}
            />
          )}
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 15,
            }}
          >
            Refresh
          </Text>
        </TouchableOpacity>
      </View>

      {/* Secondary Action Buttons + Compare */}
      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 12) }}>
        <View style={{ flexDirection: "row", marginBottom: 16, gap: 10 }}>
          <TouchableOpacity activeOpacity={0.7}
            onPress={onShare}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
            accessibilityLabel="Share product"
            accessibilityRole="button"
          >
            <IconSymbol
              name="square.and.arrow.up"
              size={16}
              color={colors.foreground}
            />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Share
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}
            onPress={onTestStockNotification}
            style={{
              flex: 1,
              backgroundColor: colors.success + "18",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.success + "44",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
            accessibilityLabel="Test stock alert"
            accessibilityRole="button"
          >
            <IconSymbol
              name="bell.badge.fill"
              size={16}
              color={colors.success}
            />
            <Text
              style={{
                color: colors.success,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Test Stock Alert
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}
            onPress={onCopyLink}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
            accessibilityLabel="Copy link"
            accessibilityRole="button"
          >
            <IconSymbol
              name="doc.on.doc"
              size={16}
              color={colors.foreground}
            />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Copy Link
            </Text>
          </TouchableOpacity>
        </View>
        {/* Compare button */}
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCompare();
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: colors.primary + "12",
            borderRadius: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.primary + "44",
            marginBottom: 16,
          }}
          accessibilityLabel="Compare distributors"
          accessibilityRole="button"
        >
          <IconSymbol
            name="arrow.left.arrow.right"
            size={16}
            color={colors.primary}
          />
          <Text
            style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}
          >
            Compare Distributors
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
