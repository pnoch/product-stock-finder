import { useCallback, useState } from "react";
import { FlatList, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { searchCatalog, PRODUCT_CATALOG } from "@/lib/catalog";
import { addToWatchlist } from "@/lib/storage";
import { Product } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScrollView } from "react-native";

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const CATEGORIES = ["All", ...Array.from(new Set(PRODUCT_CATALOG.map((p) => p.category))).sort()];

  const baseResults = query.trim().length > 0 ? searchCatalog(query) : PRODUCT_CATALOG;
  const results = activeCategory && activeCategory !== "All"
    ? baseResults.filter((p) => p.category === activeCategory)
    : baseResults;

  const handleAdd = useCallback(async (item: typeof PRODUCT_CATALOG[0]) => {
    setAdding(item.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const product: Product = {
      ...item,
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await addToWatchlist(product);
    setAdding(null);
    router.back();
  }, [router]);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", flex: 1 }}>Add Product</Text>
      </View>

      {/* Search Bar */}
      <View style={{ marginHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by model number or brand..."
          placeholderTextColor={colors.muted}
          style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: "row" }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = (activeCategory === null && cat === "All") || activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCategory(cat === "All" ? null : cat);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: isActive ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: isActive ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: isActive ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
            {query.trim() ? `${results.length} result${results.length !== 1 ? "s" : ""}` : "All Products"}
          </Text>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16, marginTop: 12 }}>No results found</Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 6 }}>Try a different model number or brand name</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }} numberOfLines={2}>{item.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{item.modelNumber}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                <View style={{ backgroundColor: colors.primary + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>{item.brand}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{item.category}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleAdd(item)}
              disabled={adding === item.id}
              style={{ backgroundColor: colors.primary, borderRadius: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              {adding === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <IconSymbol name="plus" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      />
    </ScreenContainer>
  );
}
