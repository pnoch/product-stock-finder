import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPrice } from "@shared/currency";
import {
  marketplaceBrandName,
  marketplaceCurrency,
} from "@/lib/marketplace";
import type { MarketplaceIdentity } from "@/shared/marketplace-url";
import type { EbaySearchListing } from "@/shared/ebay-search";
import type { useColors } from "@/hooks/use-colors";
import {
  fieldStyle,
  marketplaceConfirmNote,
  marketplaceSummary,
  type Draft,
} from "./manual-add-helpers";

type Colors = ReturnType<typeof useColors>;

export function ManualAddDraftStep({
  colors,
  draft,
  onDraftChange,
  marketplace,
  initialEbayListing,
  variant,
  onVariantChange,
  seller,
  onSellerChange,
  manualPrice,
  onManualPriceChange,
  aiFailed,
  progress,
  canAdd,
  adding,
  parsing,
  onAdd,
  onBack,
  onForceClose,
}: {
  colors: Colors;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  marketplace: MarketplaceIdentity | null;
  initialEbayListing?: EbaySearchListing;
  variant: string;
  onVariantChange: (value: string) => void;
  seller: string;
  onSellerChange: (value: string) => void;
  manualPrice: string;
  onManualPriceChange: (value: string) => void;
  aiFailed: boolean;
  progress: string | null;
  canAdd: boolean;
  adding: boolean;
  parsing: boolean;
  onAdd: () => void;
  onBack: () => void;
  onForceClose: () => void;
}) {
  return (
    <ScrollView>
      {aiFailed && (
        <Text style={{ color: colors.warning, fontSize: 12, marginBottom: 10 }}>
          Couldn&apos;t reach the AI — please fill in the details manually.
        </Text>
      )}
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
        Review and edit before adding.
      </Text>
      <TextInput
        value={draft.name}
        onChangeText={(v) => onDraftChange({ ...draft, name: v })}
        placeholder="Product name"
        placeholderTextColor={colors.muted}
        style={fieldStyle(colors)}
      />
      {marketplace ? (
        <>
          <Text style={{ color: colors.muted, marginBottom: 12 }}>
            {marketplaceSummary(marketplace)}{"\n"}
            {marketplaceConfirmNote(marketplace)}
            {initialEbayListing?.price !== null && initialEbayListing?.price !== undefined && initialEbayListing.currency
              ? `\nSearch price: ${formatPrice(initialEbayListing.price, initialEbayListing.currency)}${initialEbayListing.currency !== "USD" ? ". This is the displayed search currency. Enter the item's USD price below; do not copy this number as USD." : ". Confirm the current listing price before saving."}`
              : ""}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>
            Market
          </Text>
          <View
            accessibilityLabel={`Market: ${marketplace.platform === "ebay" ? "United States, US dollar" : "Thailand, Thai baht"}`}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 14 }}>
              {marketplace.platform === "ebay" ? "United States · USD" : "Thailand · THB"}
            </Text>
          </View>
          <TextInput value={variant} onChangeText={onVariantChange} placeholder={marketplace.platform === "facebook" || marketplace.platform === "ebay" ? "Variant (optional)" : "Selected variant (or Single option)"} accessibilityLabel="Selected variant" placeholderTextColor={colors.muted} style={fieldStyle(colors)} />
          <TextInput value={seller} onChangeText={onSellerChange} placeholder="Seller" accessibilityLabel="Seller" placeholderTextColor={colors.muted} style={fieldStyle(colors)} />
          <TextInput value={manualPrice} onChangeText={onManualPriceChange} placeholder={`Manually entered price (${marketplaceCurrency(marketplace.platform)})`} accessibilityLabel={`Manual ${marketplaceCurrency(marketplace.platform)} price`} keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={fieldStyle(colors)} />
        </>
      ) : (
        <>
          <TextInput
            value={draft.modelNumber}
            onChangeText={(v) => onDraftChange({ ...draft, modelNumber: v })}
            placeholder="Model number"
            placeholderTextColor={colors.muted}
            style={fieldStyle(colors)}
          />
          <TextInput
            value={draft.brand}
            onChangeText={(v) => onDraftChange({ ...draft, brand: v })}
            placeholder="Brand"
            placeholderTextColor={colors.muted}
            style={fieldStyle(colors)}
          />
          <TextInput
            value={draft.category}
            onChangeText={(v) => onDraftChange({ ...draft, category: v })}
            placeholder="Category"
            placeholderTextColor={colors.muted}
            style={fieldStyle(colors)}
          />
          <TextInput
            value={draft.description}
            onChangeText={(v) => onDraftChange({ ...draft, description: v })}
            placeholder="Description"
            placeholderTextColor={colors.muted}
            multiline
            style={{
              ...fieldStyle(colors),
              minHeight: 70,
              textAlignVertical: "top",
            }}
          />
        </>
      )}
      {progress && (
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
          {progress}
        </Text>
      )}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onAdd}
        disabled={!canAdd || adding}
        style={{
          backgroundColor: canAdd && !adding ? colors.primary : colors.border,
          opacity: !canAdd || adding ? 0.5 : 1,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginBottom: 12,
        }}
        accessibilityLabel={marketplace ? `Save manual ${marketplaceBrandName(marketplace.platform)} product` : "Add and search distributors"}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd || adding }}
      >
        {adding ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <IconSymbol name="plus.circle.fill" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              {marketplace ? `Save Manual ${marketplaceBrandName(marketplace.platform)} Product` : "Add & Search Distributors"}
            </Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onBack}
        disabled={parsing || adding}
        style={{ alignItems: "center", paddingVertical: 6, opacity: parsing || adding ? 0.5 : 1 }}
        accessibilityLabel="Back to paste"
        accessibilityRole="button"
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Back to paste
        </Text>
      </TouchableOpacity>
      {adding ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onForceClose}
          style={{ alignItems: "center", paddingVertical: 10 }}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Cancel
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
