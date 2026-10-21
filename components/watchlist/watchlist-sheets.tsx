import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { TagManageSheet } from "@/components/tag-manage-sheet";
import { BulkTagSheet } from "@/components/bulk-tag-sheet";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import type { Product, TagDefinition } from "@/lib/types";

export function WatchlistSheets({
  pickerProduct,
  onClosePicker,
  manageVisible,
  onCloseManage,
  bulkTagVisible,
  onCloseBulkTag,
  selectedIds,
  tagDefinitions,
  onChanged,
  onBulkTagChanged,
  undoProduct,
  onUndo,
  bottomInset,
  paywallVisible,
  onClosePaywall,
}: {
  pickerProduct: Product | null;
  onClosePicker: () => void;
  manageVisible: boolean;
  onCloseManage: () => void;
  bulkTagVisible: boolean;
  onCloseBulkTag: () => void;
  selectedIds: Set<string>;
  tagDefinitions: Record<string, TagDefinition>;
  onChanged: () => void;
  onBulkTagChanged: () => void;
  undoProduct: Product | null;
  onUndo: () => void;
  bottomInset: number;
  paywallVisible: boolean;
  onClosePaywall: () => void;
}) {
  const colors = useColors();
  return (
    <>
      <TagPickerSheet
        visible={!!pickerProduct}
        product={pickerProduct}
        onClose={onClosePicker}
        onChanged={onChanged}
      />
      <TagManageSheet
        visible={manageVisible}
        onClose={onCloseManage}
        onChanged={onChanged}
      />
      <BulkTagSheet
        visible={bulkTagVisible}
        productIds={Array.from(selectedIds)}
        tagDefinitions={tagDefinitions}
        onClose={onCloseBulkTag}
        onChanged={onBulkTagChanged}
      />
      {undoProduct && (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16 + bottomInset,
            backgroundColor: colors.foreground,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: colors.border + "33",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
          }}
        >
          <Text
            style={{ color: colors.background, fontSize: 13, flex: 1 }}
            numberOfLines={1}
          >
            Removed {undoProduct.name}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onUndo}
            accessibilityLabel="Undo remove"
            accessibilityRole="button"
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              Undo
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <PaywallScreen visible={paywallVisible} onClose={onClosePaywall} />
    </>
  );
}
