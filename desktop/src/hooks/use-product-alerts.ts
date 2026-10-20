import { useMemo, useState } from "react";
import { formatPrice } from "@shared/currency";
import { suggestAlertPrices } from "../../../lib/alert-suggestions";
import type {
  DistributorListing,
  PriceAlert,
  Product,
} from "../../../lib/types";
import { createPriceAlert } from "../lib/product-detail";

type Options = {
  product: Product | null;
  bestListing: DistributorListing | null | undefined;
  defaultCurrency: string;
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  showToast: (message: string) => void;
};

export function useProductAlerts({
  product,
  bestListing,
  defaultCurrency,
  setAlerts,
  showToast,
}: Options) {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");
  const [alertSaved, setAlertSaved] = useState(false);
  const [alertDirection, setAlertDirection] = useState<"drop" | "rise">("drop");
  const [alertDistributorId, setAlertDistributorId] = useState<string | null>(
    null,
  );
  const [alertError, setAlertError] = useState<string | null>(null);
  const [creatingAlert, setCreatingAlert] = useState(false);

  const [perListingAlertId, setPerListingAlertId] = useState<string | null>(
    null,
  );
  const [perListingAlertPrice, setPerListingAlertPrice] = useState("");
  const [perListingAlertCurrency, setPerListingAlertCurrency] =
    useState("USD");
  const [perListingAlertDirection, setPerListingAlertDirection] = useState<
    "drop" | "rise"
  >("drop");

  const [inlineAlertPrice, setInlineAlertPrice] = useState("");
  const [inlineAlertCurrency, setInlineAlertCurrency] = useState("USD");
  const [inlineAlertDirection, setInlineAlertDirection] = useState<
    "drop" | "rise"
  >("drop");
  const [inlineAlertDistributorId, setInlineAlertDistributorId] = useState<
    string | null
  >(null);

  // Seed the three alert currencies from the display currency, matching
  // mobile. Render-phase sync keeps the hook's state in step without an effect.
  const [prevCurrency, setPrevCurrency] = useState(defaultCurrency);
  if (defaultCurrency !== prevCurrency) {
    setPrevCurrency(defaultCurrency);
    setAlertCurrency(defaultCurrency);
    setPerListingAlertCurrency(defaultCurrency);
    setInlineAlertCurrency(defaultCurrency);
  }

  const alertSuggestions = useMemo(
    () => suggestAlertPrices(product?.listings ?? [], alertCurrency),
    [product?.listings, alertCurrency],
  );
  const perListingAlertSuggestions = useMemo(
    () => suggestAlertPrices(product?.listings ?? [], perListingAlertCurrency),
    [product?.listings, perListingAlertCurrency],
  );

  const openSetAlert = () => {
    setAlertDistributorId(bestListing?.distributorId ?? null);
    setAlertOpen(true);
  };

  const closeSetAlert = () => {
    setAlertOpen(false);
    setAlertSaved(false);
    setAlertPrice("");
    setAlertError(null);
  };

  const handleSaveAlert = async () => {
    if (!product || !alertPrice || creatingAlert) return;
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) return;

    const distributorId = alertDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId,
        targetPrice: price,
        currency: alertCurrency,
        direction: alertDirection,
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      setAlertError(
        "Please enable notifications in your system settings to receive price alerts.",
      );
      return;
    }
    setAlerts((prev) => [...prev, alert]);
    setAlertError(null);

    setAlertSaved(true);
    setTimeout(() => {
      setAlertOpen(false);
      setAlertSaved(false);
      setAlertPrice("");
      setAlertError(null);
    }, 1200);
  };

  const openPerListingAlert = (listing: DistributorListing) => {
    setPerListingAlertId(listing.distributorId);
    setPerListingAlertPrice(String(listing.price));
    setPerListingAlertCurrency(listing.currency);
  };

  const closePerListingAlert = () => {
    setPerListingAlertId(null);
    setPerListingAlertPrice("");
  };

  const handlePerListingAlert = async () => {
    if (!product || !perListingAlertId || creatingAlert) return;
    const price = parseFloat(perListingAlertPrice);
    if (isNaN(price) || price <= 0) return;
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId: perListingAlertId,
        targetPrice: price,
        currency: perListingAlertCurrency,
        direction: perListingAlertDirection,
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      showToast(
        "Please enable notifications in your system settings to receive price alerts.",
      );
      return;
    }
    setAlerts((prev) => [...prev, alert]);
    setPerListingAlertId(null);
    setPerListingAlertPrice("");
    showToast("Alert set for distributor");
  };

  const handleInlineAlert = async () => {
    if (!product || creatingAlert) return;
    const price = parseFloat(inlineAlertPrice);
    if (isNaN(price) || price <= 0) {
      showToast("Enter a valid target price");
      return;
    }
    const distributorId =
      inlineAlertDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId,
        targetPrice: price,
        currency: inlineAlertCurrency,
        direction: inlineAlertDirection,
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      showToast(
        "Please enable notifications in your system settings to receive price alerts.",
      );
      return;
    }
    setAlerts((prev) => [...prev, alert]);
    setInlineAlertPrice("");
    showToast("Alert created");
  };

  const handleQuickAlert = async () => {
    if (!product || !bestListing || creatingAlert) return;
    const suggested = Math.round(bestListing.price * 0.95 * 100) / 100;
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId: bestListing.distributorId,
        targetPrice: suggested,
        currency: bestListing.currency,
        direction: "drop",
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      showToast(
        "Please enable notifications in your system settings to receive price alerts.",
      );
      return;
    }
    setAlerts((prev) => [...prev, alert]);
    showToast(`Alert set at ${formatPrice(suggested, bestListing.currency)}`);
  };

  return {
    alertOpen,
    setAlertOpen,
    alertPrice,
    setAlertPrice,
    alertCurrency,
    setAlertCurrency,
    alertSaved,
    alertDirection,
    setAlertDirection,
    alertDistributorId,
    setAlertDistributorId,
    alertError,
    alertSuggestions,
    creatingAlert,
    openSetAlert,
    closeSetAlert,
    handleSaveAlert,
    perListingAlertId,
    setPerListingAlertId,
    perListingAlertPrice,
    setPerListingAlertPrice,
    perListingAlertCurrency,
    setPerListingAlertCurrency,
    perListingAlertDirection,
    setPerListingAlertDirection,
    perListingAlertSuggestions,
    openPerListingAlert,
    closePerListingAlert,
    handlePerListingAlert,
    inlineAlertPrice,
    setInlineAlertPrice,
    inlineAlertCurrency,
    setInlineAlertCurrency,
    inlineAlertDirection,
    setInlineAlertDirection,
    inlineAlertDistributorId,
    setInlineAlertDistributorId,
    handleInlineAlert,
    handleQuickAlert,
  };
}
