import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { RecentSearches } from "@/components/search/recent-searches";
import { TagFilterRow } from "@/components/tag-filter-row";
import { PillFilterRow } from "@/components/search/pill-filter-row";
import type { CatalogSort } from "@/hooks/use-catalog-search";
import type { TagDefinition } from "@/lib/types";

const CATALOG_SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "price", label: "Price" },
];

export function SearchListHeader({
  mode,
  query,
  recentSearches,
  onSelectRecent,
  onClearRecent,
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  tagCounts,
  onToggleTag,
  onChangeTagMode,
  onClearTags,
  categories,
  brands,
  selectedCategory,
  onCategoryChange,
  selectedBrand,
  onBrandChange,
  catalogSort,
  onSortChange,
  filtersExpanded,
  onShowFilters,
  onHideFilters,
  resultCount,
}: {
  mode: "add" | "discover";
  query: string;
  recentSearches: string[];
  onSelectRecent: (query: string) => void;
  onClearRecent: () => void;
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  tagCounts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeTagMode: (mode: "any" | "all") => void;
  onClearTags: () => void;
  categories: string[];
  brands: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  selectedBrand: string | null;
  onBrandChange: (brand: string | null) => void;
  catalogSort: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
  filtersExpanded: boolean;
  onShowFilters: () => void;
  onHideFilters: () => void;
  resultCount: number;
}) {
  const colors = useColors();
  if (mode !== "add" && !query.trim()) return null;

  return (
    <View>
      {query.length === 0 && (
        <RecentSearches
          searches={recentSearches}
          onSelect={onSelectRecent}
          onClear={onClearRecent}
        />
      )}

      {Object.keys(tagDefinitions).length > 0 && (
        <TagFilterRow
          tagDefinitions={tagDefinitions}
          selectedTagIds={selectedTagIds}
          tagMatchMode={tagMatchMode}
          counts={tagCounts}
          onToggleTag={onToggleTag}
          onChangeMode={onChangeTagMode}
          onClearAll={onClearTags}
        />
      )}

      {/* Category / Brand filters — collapsed behind a toggle while searching
          so the ~40 chips don't push results below the fold. */}
      {query.trim().length > 0 && !filtersExpanded ? (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Show filters"
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onShowFilters();
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
        >
          <IconSymbol
            name="slider.horizontal.3"
            size={16}
            color={colors.primary}
          />
          <Text
            style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
          >
            Filters{selectedCategory || selectedBrand ? " · active" : ""}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <PillFilterRow
            label="Category"
            options={categories}
            selected={selectedCategory}
            onSelect={onCategoryChange}
            colors={colors}
          />
          <PillFilterRow
            label="Brand"
            options={brands}
            selected={selectedBrand}
            onSelect={onBrandChange}
            colors={colors}
          />
          {query.trim().length > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Hide filters"
              onPress={onHideFilters}
              style={{ paddingHorizontal: 16, paddingBottom: 10 }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Hide filters
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Catalog sort bar — parity with watchlist SortGroupBar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <Text
          style={{
            color: colors.muted,
            fontSize: 11,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Sort
        </Text>
        {CATALOG_SORT_OPTIONS.map((opt) => {
          const active = catalogSort === opt.key;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              key={opt.key}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSortChange(opt.key);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={{
                  color: active ? "#fff" : colors.muted,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {(selectedCategory || selectedBrand) && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              onCategoryChange(null);
              onBrandChange(null);
            }}
            style={{ padding: 4 }}
            accessibilityLabel="Clear category/brand filter"
            accessibilityRole="button"
          >
            <Text
              style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}
            >
              Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedTagIds.length > 0 && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 10,
            borderRadius: 10,
            backgroundColor: colors.primary + "14",
            borderWidth: 1,
            borderColor: colors.primary + "33",
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Tag filter: showing watchlist matches only — clear to see catalog
          </Text>
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          {query.trim()
            ? `${resultCount} catalog result${resultCount !== 1 ? "s" : ""}`
            : "All Products"}
        </Text>
        {query.trim().length > 0 && resultCount > 0 && (
          <View
            style={{
              backgroundColor: colors.primary + "14",
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {resultCount}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
