import {
  Platform,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { CURRENCY_SYMBOLS } from "@shared/currency";
import { RegionFilterRow } from "@/components/watchlist/region-filter-row";
import { TagFilterRow } from "@/components/tag-filter-row";
import { useColors } from "@/hooks/use-colors";
import type { TagDefinition } from "@/lib/types";

type WatchlistFilterPanelProps = {
  visible: boolean;
  regions: string[];
  regionFilter: string;
  onRegionChange: (region: string) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  showAcquired: boolean;
  onShowAcquiredChange: (value: boolean) => void;
  displayCurrency: string;
  priceMinInput: string;
  priceMaxInput: string;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onClearPrice: () => void;
  priceFilterActive: boolean;
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  tagCounts: Record<string, number>;
  onToggleTag: (id: string) => void;
  onChangeTagMode: (mode: "any" | "all") => void;
  onClearTags: () => void;
  onManageTags: () => void;
  activeFilterCount: number;
  onClearAll: () => void;
};

export function WatchlistFilterPanel({
  visible,
  regions,
  regionFilter,
  onRegionChange,
  inStockOnly,
  onInStockOnlyChange,
  showAcquired,
  onShowAcquiredChange,
  displayCurrency,
  priceMinInput,
  priceMaxInput,
  onPriceMinChange,
  onPriceMaxChange,
  onClearPrice,
  priceFilterActive,
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  tagCounts,
  onToggleTag,
  onChangeTagMode,
  onClearTags,
  onManageTags,
  activeFilterCount,
  onClearAll,
}: WatchlistFilterPanelProps) {
  const colors = useColors();
  if (!visible) return null;

  return (
    <View>
      <RegionFilterRow
        regions={regions}
        regionFilter={regionFilter}
        onRegionChange={onRegionChange}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}
          >
            In stock only
          </Text>
          <Switch
            value={inStockOnly}
            onValueChange={onInStockOnlyChange}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}
          >
            Show acquired
          </Text>
          <Switch
            value={showAcquired}
            onValueChange={onShowAcquiredChange}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flex: 1,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency}
          </Text>
          <TextInput
            placeholder="Min"
            value={priceMinInput}
            onChangeText={onPriceMinChange}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              minWidth: 60,
              color: colors.foreground,
              fontSize: 12,
            }}
            placeholderTextColor={colors.muted}
            accessibilityLabel="Minimum price"
          />
          <Text style={{ color: colors.muted }}>—</Text>
          <TextInput
            placeholder="Max"
            value={priceMaxInput}
            onChangeText={onPriceMaxChange}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              minWidth: 60,
              color: colors.foreground,
              fontSize: 12,
            }}
            placeholderTextColor={colors.muted}
            accessibilityLabel="Maximum price"
          />
          {priceFilterActive && (
            <TouchableOpacity
              onPress={onClearPrice}
              accessibilityLabel="Clear price filter"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TagFilterRow
        tagDefinitions={tagDefinitions}
        selectedTagIds={selectedTagIds}
        tagMatchMode={tagMatchMode}
        counts={tagCounts}
        onToggleTag={onToggleTag}
        onChangeMode={onChangeTagMode}
        onClearAll={onClearTags}
        onManage={onManageTags}
      />
      {activeFilterCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClearAll();
          }}
          style={{
            alignSelf: "flex-end",
            marginRight: 20,
            marginBottom: 10,
            padding: 4,
          }}
          accessibilityLabel="Clear all filters"
          accessibilityRole="button"
        >
          <Text
            style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
          >
            Clear all
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
