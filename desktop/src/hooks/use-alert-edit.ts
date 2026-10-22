import { useMemo, useState } from "react";
import { getDistributorById } from "@shared/distributors";
import { storage } from "../storage";
import type { PriceAlert, Product } from "../../../lib/types";

export function useAlertEdit({
  watchlistProducts,
  showToast,
  refreshAlerts,
}: {
  watchlistProducts: Product[];
  showToast: (message: string) => void;
  refreshAlerts: () => void;
}) {
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editDirection, setEditDirection] = useState<"drop" | "rise">("drop");
  const [editDistributorId, setEditDistributorId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditAlert = (alert: PriceAlert) => {
    setEditingAlert(alert);
    setEditPrice(String(alert.targetPrice));
    setEditCurrency(alert.currency);
    setEditDirection(alert.direction ?? "drop");
    setEditDistributorId(alert.distributorId ?? null);
    setEditError(null);
  };

  const editDistributors = useMemo(() => {
    if (!editingAlert) return [];
    const productId = editingAlert.productId;
    return (
      (watchlistProducts.find((p) => p.id === productId)?.listings ?? []).map(
        (l) => {
          const d = getDistributorById(l.distributorId);
          return { id: l.distributorId, name: d?.name ?? l.distributorId, countryCode: d?.countryCode ?? "" };
        },
      )
    );
  }, [editingAlert, watchlistProducts]);

  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    const price = parseFloat(editPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setEditError("Please enter a valid target price.");
      return;
    }
    setEditError(null);
    try {
      await storage.updateAlert(editingAlert.id, {
        targetPrice: price,
        currency: editCurrency,
        direction: editDirection,
        distributorId: editDistributorId,
      });
    } catch {
      setEditError("Couldn't save your changes. Please try again.");
      return;
    }
    setEditingAlert(null);
    showToast("Alert updated");
    refreshAlerts();
  };

  return {
    editingAlert,
    editPrice,
    setEditPrice,
    editCurrency,
    setEditCurrency,
    editDirection,
    setEditDirection,
    editDistributorId,
    setEditDistributorId,
    editError,
    editDistributors,
    handleEditAlert,
    handleSaveEdit,
    closeEditAlert: () => setEditingAlert(null),
  };
}
