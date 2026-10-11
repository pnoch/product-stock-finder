import { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { setOnboardingSeen } from "@/lib/onboarding";
import { showAlert } from "@/lib/alert";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CountryPicker } from "@/components/ui/country-picker";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import {
  addAlert,
  addStockWatch,
  addToWatchlist,
  updateSettings,
} from "@/lib/storage";
import { clampSelection, defaultAlertTarget } from "@/lib/concierge";
import { getCountry } from "@shared/countries";
import { PRODUCT_CATALOG, searchCatalog } from "@shared/catalog";
import type { Product } from "@/lib/types";

const MAX_SELECTION = 5;
const RESULT_LIMIT = 15;

type CatalogEntry = (typeof PRODUCT_CATALOG)[number];

function toProduct(entry: CatalogEntry): Product {
  return {
    ...entry,
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings: [],
    tags: [],
  };
}

function tap() {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function ConciergeScreen({ onComplete }: { onComplete: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [taxExempt, setTaxExempt] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [notifyDrops, setNotifyDrops] = useState(true);
  const [notifyStock, setNotifyStock] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const results = useMemo<CatalogEntry[]>(() => {
    const q = query.trim();
    if (!q) return PRODUCT_CATALOG.slice(0, RESULT_LIMIT);
    return searchCatalog(q).slice(0, RESULT_LIMIT);
  }, [query]);

  const selectedProducts = useMemo(() => {
    const byId = new Map(PRODUCT_CATALOG.map((p) => [p.id, p]));
    return selectedIds.flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [toProduct(entry)] : [];
    });
  }, [selectedIds]);

  const displayCurrency = country
    ? (getCountry(country)?.currency ?? "USD")
    : "USD";

  const projectedAlerts = useMemo(() => {
    if (!notifyDrops) return 0;
    return selectedProducts.filter(
      (p) => defaultAlertTarget(p, displayCurrency) !== null,
    ).length;
  }, [notifyDrops, selectedProducts, displayCurrency]);

  const projectedWatches = notifyStock ? selectedProducts.length : 0;

  const skip = async () => {
    await setOnboardingSeen();
    onComplete();
  };

  const toggleSelect = (id: string) => {
    tap();
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : clampSelection([...prev, id], MAX_SELECTION),
    );
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      for (const product of selectedProducts) {
        await addToWatchlist(product);
        if (notifyDrops) {
          const target = defaultAlertTarget(product, displayCurrency);
          if (target) {
            await addAlert({
              id: `alert-${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              productId: product.id,
              targetPrice: target.targetPrice,
              currency: target.currency,
              createdAt: new Date().toISOString(),
              isActive: true,
            });
          }
        }
        if (notifyStock) {
          await addStockWatch({
            id: `${product.id}-any`,
            productId: product.id,
            productName: product.name,
            distributorId: "*",
            distributorName: "Any distributor",
            reminderDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderType: "back_in_stock",
            scope: "any",
            lastKnownStatusByDistributor: Object.fromEntries(
              product.listings.map((l) => [l.distributorId, l.stockStatus]),
            ),
          });
        }
      }
      await updateSettings({
        ...(country
          ? {
              shipToCountry: country,
              displayCurrency: getCountry(country)?.currency ?? undefined,
            }
          : {}),
        taxExempt,
        digestFrequency: notifyDigest ? "daily" : "off",
      });
      await setOnboardingSeen();
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Couldn't finish setup",
        "We couldn't save your concierge setup. Please try again.",
      );
    } finally {
      setFinishing(false);
    }
  };

  const goBack = () => {
    tap();
    setStep((s) => Math.max(0, s - 1));
  };

  const goNext = () => {
    tap();
    setStep((s) => Math.min(3, s + 1));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => void skip()}
        style={{
          position: "absolute",
          top: insets.top + 12,
          right: 20,
          zIndex: 1,
          padding: 8,
        }}
        accessibilityLabel="Skip onboarding"
        accessibilityRole="button"
      >
        <Text style={{ color: colors.muted, fontSize: 14 }}>Skip</Text>
      </TouchableOpacity>

      <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
        <Text
          style={{
            color: colors.muted,
            fontSize: 13,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          {step < 3 ? `Step ${step + 1} of 3` : "All set"}
        </Text>

        {step === 0 && (
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 28,
                fontWeight: "700",
                textAlign: "center",
                marginTop: 8,
                paddingHorizontal: 32,
              }}
            >
              What are you hunting for?
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                textAlign: "center",
                marginTop: 8,
                paddingHorizontal: 32,
              }}
            >
              {selectedIds.length} of {MAX_SELECTION} selected
            </Text>
            <View style={{ marginTop: 16 }}>
              <CatalogSearchBar query={query} onQueryChange={setQuery} />
            </View>
            <FlatList
              style={{ flex: 1 }}
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <Pressable
                    onPress={() => toggleSelect(item.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginHorizontal: 16,
                      marginBottom: 8,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: selected
                        ? colors.primary + "14"
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                    }}
                    accessibilityLabel={`${selected ? "Deselect" : "Select"} ${item.name}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 13,
                          marginTop: 2,
                        }}
                      >
                        {item.brand} · {item.modelNumber}
                      </Text>
                    </View>
                    <IconSymbol
                      name={
                        selected ? "checkmark.circle.fill" : "circle.fill"
                      }
                      size={22}
                      color={selected ? colors.primary : colors.muted}
                    />
                  </Pressable>
                );
              }}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={goNext}
              disabled={selectedIds.length === 0}
              style={{
                marginHorizontal: 32,
                marginBottom: 32,
                paddingVertical: 15,
                borderRadius: 14,
                backgroundColor:
                  selectedIds.length === 0 ? colors.border : colors.primary,
                alignItems: "center",
              }}
              accessibilityLabel="Continue"
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={{ flex: 1, paddingHorizontal: 32 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 28,
                fontWeight: "700",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Where do you ship to?
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                textAlign: "center",
                marginTop: 10,
                lineHeight: 22,
              }}
            >
              We use this to estimate landed cost and show prices in your local
              currency.
            </Text>

            <Pressable
              onPress={() => setPickerVisible(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingVertical: 15,
                paddingHorizontal: 16,
                marginTop: 28,
              }}
              accessibilityLabel="Choose shipping country"
              accessibilityRole="button"
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <IconSymbol name="globe" size={20} color={colors.primary} />
                <Text
                  style={{
                    color: country ? colors.foreground : colors.muted,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {country
                    ? (getCountry(country)?.name ?? "Choose country")
                    : "Choose country"}
                </Text>
              </View>
              <IconSymbol
                name="chevron.right"
                size={16}
                color={colors.muted}
              />
            </Pressable>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                paddingHorizontal: 4,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  flex: 1,
                  marginRight: 12,
                }}
              >
                I&apos;m tax-exempt (VAT/EORI)
              </Text>
              <Switch
                value={taxExempt}
                onValueChange={setTaxExempt}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={taxExempt ? colors.primary : colors.muted}
                accessibilityLabel="I'm tax-exempt"
                accessibilityRole="switch"
              />
            </View>

            <View style={{ flex: 1 }} />
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginBottom: 32,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={goBack}
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
                accessibilityLabel="Back"
                accessibilityRole="button"
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={goNext}
                style={{
                  flex: 2,
                  paddingVertical: 15,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                }}
                accessibilityLabel="Continue"
                accessibilityRole="button"
              >
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ flex: 1, paddingHorizontal: 32 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 28,
                fontWeight: "700",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              How should we notify you?
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                textAlign: "center",
                marginTop: 10,
                lineHeight: 22,
              }}
            >
              Smart defaults are on — tune them any time in Settings.
            </Text>

            {(
              [
                {
                  title: "Price drops",
                  body: "Alert me when a tracked product drops below my target.",
                  value: notifyDrops,
                  set: setNotifyDrops,
                  label: "Price drop notifications",
                },
                {
                  title: "Back in stock",
                  body: "Watch for restocks across all distributors.",
                  value: notifyStock,
                  set: setNotifyStock,
                  label: "Back in stock notifications",
                },
                {
                  title: "Price digest",
                  body: "A periodic roundup of price moves.",
                  value: notifyDigest,
                  set: setNotifyDigest,
                  label: "Price digest notifications",
                },
              ] as const
            ).map((row) => (
              <View
                key={row.title}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  >
                    {row.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 13,
                      marginTop: 4,
                      lineHeight: 18,
                    }}
                  >
                    {row.body}
                  </Text>
                </View>
                <Switch
                  value={row.value}
                  onValueChange={row.set}
                  trackColor={{
                    false: colors.border,
                    true: colors.primary + "88",
                  }}
                  thumbColor={row.value ? colors.primary : colors.muted}
                  accessibilityLabel={row.label}
                  accessibilityRole="switch"
                />
              </View>
            ))}

            <View style={{ flex: 1 }} />
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginBottom: 32,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={goBack}
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
                accessibilityLabel="Back"
                accessibilityRole="button"
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={goNext}
                style={{
                  flex: 2,
                  paddingVertical: 15,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                }}
                accessibilityLabel="Continue"
                accessibilityRole="button"
              >
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ flex: 1, paddingHorizontal: 32 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 28,
                fontWeight: "700",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              You&apos;re all set
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                textAlign: "center",
                marginTop: 10,
                lineHeight: 22,
              }}
            >
              Tracking {selectedProducts.length} product
              {selectedProducts.length === 1 ? "" : "s"} across 25 stores
            </Text>

            <View
              style={{
                marginTop: 24,
                padding: 16,
                borderRadius: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {selectedProducts.slice(0, MAX_SELECTION).map((p) => (
                <Text
                  key={p.id}
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 6,
                  }}
                >
                  · {p.name}
                </Text>
              ))}
              <Text
                style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}
              >
                {projectedAlerts} price alert
                {projectedAlerts === 1 ? "" : "s"} · {projectedWatches}{" "}
                restock watch{projectedWatches === 1 ? "" : "es"}
              </Text>
            </View>

            <View style={{ flex: 1 }} />
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginBottom: 32,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={goBack}
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
                accessibilityLabel="Back"
                accessibilityRole="button"
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void finish()}
                disabled={finishing}
                style={{
                  flex: 2,
                  paddingVertical: 15,
                  borderRadius: 14,
                  backgroundColor: finishing
                    ? colors.border
                    : colors.primary,
                  alignItems: "center",
                }}
                accessibilityLabel="Finish"
                accessibilityRole="button"
              >
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}
                >
                  {finishing ? "Saving…" : "Finish"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <CountryPicker
        visible={pickerVisible}
        value={country ?? undefined}
        onSelect={(code) => {
          setCountry(code);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}
