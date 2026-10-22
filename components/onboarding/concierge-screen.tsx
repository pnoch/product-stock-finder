import { useMemo, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { setOnboardingSeen } from "@/lib/onboarding";
import { showAlert } from "@/lib/alert";
import { CountryPicker } from "@/components/ui/country-picker";
import { ConciergeStepProducts } from "./concierge-step-products";
import { ConciergeStepRegion } from "./concierge-step-region";
import { ConciergeStepNotifications } from "./concierge-step-notifications";
import { ConciergeStepSummary } from "./concierge-step-summary";
import {
  addAlert,
  addStockWatch,
  addToWatchlist,
  getSettings,
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

  const pendingPreview = useMemo(() => {
    if (!notifyDrops) return 0;
    return selectedProducts.filter(
      (p) => defaultAlertTarget(p, displayCurrency) === null,
    ).length;
  }, [notifyDrops, selectedProducts, displayCurrency]);

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
      const createdAlertIds = new Set<string>();
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
            createdAlertIds.add(product.id);
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
        ...(notifyDrops
          ? {
              pendingAlertProductIds: Array.from(
                new Set([
                  ...((await getSettings().catch(() => null))
                    ?.pendingAlertProductIds ?? []),
                  ...selectedProducts
                    .filter((p) => !createdAlertIds.has(p.id))
                    .map((p) => p.id),
                ]),
              ),
            }
          : {}),
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
          <ConciergeStepProducts
            colors={colors}
            query={query}
            onQueryChange={setQuery}
            results={results}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onNext={goNext}
            maxSelection={MAX_SELECTION}
          />
        )}

        {step === 1 && (
          <ConciergeStepRegion
            colors={colors}
            country={country}
            onOpenPicker={() => setPickerVisible(true)}
            taxExempt={taxExempt}
            onTaxExemptChange={setTaxExempt}
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {step === 2 && (
          <ConciergeStepNotifications
            colors={colors}
            notifyDrops={notifyDrops}
            onNotifyDropsChange={setNotifyDrops}
            notifyStock={notifyStock}
            onNotifyStockChange={setNotifyStock}
            notifyDigest={notifyDigest}
            onNotifyDigestChange={setNotifyDigest}
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {step === 3 && (
          <ConciergeStepSummary
            colors={colors}
            selectedProducts={selectedProducts}
            projectedAlerts={projectedAlerts}
            projectedWatches={projectedWatches}
            pendingPreview={pendingPreview}
            finishing={finishing}
            onBack={goBack}
            onFinish={() => void finish()}
            maxSelection={MAX_SELECTION}
          />
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
