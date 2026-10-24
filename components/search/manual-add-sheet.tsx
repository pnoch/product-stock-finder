import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { ManualAddInputStep } from "./manual-add-input-step";
import { ManualAddDraftStep } from "./manual-add-draft-step";
import { useManualAddSheet } from "@/hooks/use-manual-add-sheet";
import type { EbaySearchListing } from "@/shared/ebay-search";

export function ManualAddSheet({
  visible,
  onClose,
  initialText,
  initialEbayListing,
  trackedIds,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  initialText?: string;
  initialEbayListing?: EbaySearchListing;
  trackedIds: Set<string>;
  onAdded?: () => void;
}) {
  const colors = useColors();
  const {
    paywallVisible,
    setPaywallVisible,
    raw,
    setRaw,
    urlInput,
    setUrlInput,
    urlParsing,
    draft,
    setDraft,
    parsing,
    adding,
    progress,
    aiFailed,
    marketplace,
    setMarketplace,
    variant,
    setVariant,
    seller,
    setSeller,
    manualPrice,
    setManualPrice,
    canAdd,
    isUrlLike,
    resetForm,
    handleParse,
    handleUrlParse,
    handleAdd,
    handleClose,
    handleForceClose,
  } = useManualAddSheet({
    visible,
    onClose,
    initialText,
    initialEbayListing,
    trackedIds,
    onAdded,
  });

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={resetForm}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        accessibilityViewIsModal
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "85%",
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Add Custom Product
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={handleClose} style={{ padding: 4 }} accessibilityLabel="Close" accessibilityRole="button">
              <IconSymbol
                name="xmark.circle.fill"
                size={24}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          {draft === null ? (
            <ManualAddInputStep
              colors={colors}
              raw={raw}
              onRawChange={setRaw}
              urlInput={urlInput}
              onUrlInputChange={setUrlInput}
              parsing={parsing}
              urlParsing={urlParsing}
              onParse={() => void handleParse()}
              onUrlParse={() => void handleUrlParse()}
              isUrlLike={isUrlLike}
            />
          ) : (
            <ManualAddDraftStep
              colors={colors}
              draft={draft}
              onDraftChange={setDraft}
              marketplace={marketplace}
              initialEbayListing={initialEbayListing}
              variant={variant}
              onVariantChange={setVariant}
              seller={seller}
              onSellerChange={setSeller}
              manualPrice={manualPrice}
              onManualPriceChange={setManualPrice}
              aiFailed={aiFailed}
              progress={progress}
              canAdd={canAdd}
              adding={adding}
              parsing={parsing}
              onAdd={() => void handleAdd()}
              onBack={() => { setDraft(null); setMarketplace(null); }}
              onForceClose={handleForceClose}
            />
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
    <PaywallScreen
      visible={paywallVisible}
      onClose={() => setPaywallVisible(false)}
    />
    </>
  );
}
