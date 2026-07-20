import { useCallback, useState, useEffect, useRef } from "react";
import { FlatList, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { searchCatalog, PRODUCT_CATALOG, CATALOG_ADDED_AT } from "@/lib/catalog";
import { addToWatchlist, getRecentlyViewed } from "@/lib/storage";
import { Product } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScrollView } from "react-native";
// expo-camera is not available on web; guard with Platform check
const isNative = Platform.OS !== "web";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CameraModule: any = isNative ? require("expo-camera") : {};
const CameraView = CameraModule.CameraView ?? (() => null);
const useCameraPermissions: () => [any, () => Promise<any>] = CameraModule.useCameraPermissions ?? (() => [{ granted: false }, async () => ({ granted: false })]);

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  useEffect(() => {
    getRecentlyViewed().then(setRecentlyViewedIds);
  }, []);

  const recentlyViewed = recentlyViewedIds
    .map((id) => PRODUCT_CATALOG.find((p) => p.id === id))
    .filter(Boolean) as typeof PRODUCT_CATALOG;

  const CATEGORIES = ["All", ...Array.from(new Set(PRODUCT_CATALOG.map((p) => p.category))).sort()];

  const handleOpenScanner = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Barcode scanning requires a physical device.");
      return;
    }
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Camera Permission Required", "Please allow camera access to scan barcodes.");
        return;
      }
    }
    scanLock.current = false;
    setScannerVisible(true);
  }, [cameraPermission, requestCameraPermission]);

  const handleBarcodeScan = useCallback(({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setScannerVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const match = PRODUCT_CATALOG.find(
      (p) => p.modelNumber.toLowerCase() === data.toLowerCase() || p.id === data.toLowerCase()
    );
    if (match) {
      Alert.alert("Product Found!", match.name, [
        { text: "View Product", onPress: () => router.push(`/product/${match.id}` as any) },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      setQuery(data);
    }
  }, [router]);

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
        <TouchableOpacity onPress={handleOpenScanner} style={{ padding: 4 }}>
          <IconSymbol name="barcode.viewfinder" size={26} color={colors.primary} />
        </TouchableOpacity>
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
          <>
            {!query.trim() && recentlyViewed.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Recently Viewed</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row" }}>
                  {recentlyViewed.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => router.push(`/product/${item.id}` as any)}
                      style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, width: 140 }}
                    >
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }} numberOfLines={2}>{item.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{item.brand}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
              {query.trim() ? `${results.length} result${results.length !== 1 ? "s" : ""}` : "All Products"}
            </Text>
          </>
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15, flexShrink: 1 }} numberOfLines={2}>{item.name}</Text>
                {(() => {
                  const addedAt = CATALOG_ADDED_AT[item.id];
                  if (!addedAt) return null;
                  const daysAgo = (Date.now() - new Date(addedAt).getTime()) / (1000 * 60 * 60 * 24);
                  if (daysAgo > 7) return null;
                  return (
                    <View style={{ backgroundColor: colors.success + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: colors.success, fontSize: 10, fontWeight: "700" }}>NEW</Text>
                    </View>
                  );
                })()}
              </View>
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
      {/* Barcode Scanner Modal */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] }}
            onBarcodeScanned={handleBarcodeScan}
          />
          <View style={{ position: "absolute", top: 60, left: 0, right: 0, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              Point camera at a barcode
            </Text>
          </View>
          <View style={{ position: "absolute", bottom: 60, left: 0, right: 0, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => setScannerVisible(false)}
              style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 30, paddingHorizontal: 32, paddingVertical: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
