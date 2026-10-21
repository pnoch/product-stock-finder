import { useCallback, useMemo, useState } from "react";
import { getDistributorById } from "@shared/distributors";
import type { PriceAlert, Product } from "@/lib/types";

export function useAlertEditDraft(
  alerts: PriceAlert[],
  products: Product[],
) {
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editDirection, setEditDirection] = useState<"drop" | "rise">("drop");
  const [editDistributorId, setEditDistributorId] = useState<string | null>(
    null,
  );

  const handleEditAlert = useCallback(
    (alertId: string) => {
      const alert = alerts.find((a) => a.id === alertId);
      if (!alert) return;
      setEditingAlert(alert);
      setEditPrice(String(alert.targetPrice));
      setEditCurrency(alert.currency);
      setEditDirection(alert.direction ?? "drop");
      setEditDistributorId(alert.distributorId ?? null);
    },
    [alerts],
  );

  const editDistributors = useMemo(() => {
    if (!editingAlert) return [];
    const productId = editingAlert.productId;
    return (
      (products.find((p) => p.id === productId)?.listings ?? []).map((l) => {
        const d = getDistributorById(l.distributorId);
        return {
          id: l.distributorId,
          name: d?.name ?? l.distributorId,
          countryCode: d?.countryCode ?? "",
        };
      }) ?? []
    );
  }, [editingAlert, products]);

  return {
    editingAlert,
    setEditingAlert,
    editPrice,
    setEditPrice,
    editCurrency,
    setEditCurrency,
    editDirection,
    setEditDirection,
    editDistributorId,
    setEditDistributorId,
    handleEditAlert,
    editDistributors,
  };
}
