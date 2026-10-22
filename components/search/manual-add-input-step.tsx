import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  isEbayInput,
  isFacebookInput,
  isLazadaInput,
  isShopeeInput,
} from "@/shared/marketplace-url";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

function fieldStyle(colors: Colors) {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontSize: 15,
    marginBottom: 12,
  } as const;
}

export function ManualAddInputStep({
  colors,
  raw,
  onRawChange,
  urlInput,
  onUrlInputChange,
  parsing,
  urlParsing,
  onParse,
  onUrlParse,
  isUrlLike,
}: {
  colors: Colors;
  raw: string;
  onRawChange: (value: string) => void;
  urlInput: string;
  onUrlInputChange: (value: string) => void;
  parsing: boolean;
  urlParsing: boolean;
  onParse: () => void;
  onUrlParse: () => void;
  isUrlLike: (value: string) => boolean;
}) {
  const parseLabel = isFacebookInput(raw)
    ? "Import Facebook Link"
    : isLazadaInput(raw)
      ? "Resolve Lazada Link"
      : isShopeeInput(raw)
        ? "Resolve Shopee Link"
        : isEbayInput(raw)
          ? "Resolve eBay Link"
          : "Clean up with AI";
  return (
    <>
      <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
        Paste anything — a model number, product name, or a spec-sheet
        paragraph, or a Shopee Thailand / Lazada Thailand / Facebook
        Marketplace / eBay product link. Marketplace imports require manual
        confirmation.
      </Text>
      <TextInput
        value={raw}
        onChangeText={onRawChange}
        multiline
        autoFocus
        placeholder={
          "e.g. MikroTik CRS326-24S+2Q+RM switch, 24x SFP+ 2x QSFP+, desktop rackmount"
        }
        placeholderTextColor={colors.muted}
        style={{
          ...fieldStyle(colors),
          minHeight: 110,
          textAlignVertical: "top",
        }}
      />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onParse}
        disabled={parsing || raw.trim().length === 0}
        style={{
          backgroundColor:
            raw.trim().length > 0 && !parsing ? colors.primary : colors.border,
          opacity: parsing || raw.trim().length === 0 ? 0.5 : 1,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
        accessibilityLabel={parseLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: parsing || raw.trim().length === 0 }}
      >
        {parsing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <IconSymbol name="wand.and.stars" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              {parseLabel}
            </Text>
          </>
        )}
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>
        Paste distributor, Shopee Thailand, Lazada Thailand, Facebook Marketplace, or eBay URL
      </Text>
      <TextInput
        value={urlInput}
        onChangeText={onUrlInputChange}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="https://distributor.com/product/..."
        placeholderTextColor={colors.muted}
        style={{
          ...fieldStyle(colors),
          marginBottom: 12,
        }}
      />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onUrlParse}
        disabled={urlParsing || !isUrlLike(urlInput)}
        style={{
          backgroundColor:
            isUrlLike(urlInput) && !urlParsing ? colors.primary : colors.border,
          opacity: isUrlLike(urlInput) && !urlParsing ? 1 : 0.5,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
        accessibilityLabel="Fetch from URL"
        accessibilityRole="button"
        accessibilityState={{ disabled: urlParsing || !isUrlLike(urlInput) }}
      >
        {urlParsing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <IconSymbol name="link" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Fetch from URL
            </Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
}
