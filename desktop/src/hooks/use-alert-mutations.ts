import { storage } from "../storage";

export function useAlertMutations({
  refreshAlerts,
  showToast,
}: {
  refreshAlerts: () => void;
  showToast: (message: string) => void;
}) {
  const handleToggle = async (id: string) => {
    try {
      await storage.toggleAlert(id);
      const updated = await storage.getAlerts();
      const target = updated.find((a) => a.id === id);
      showToast(target?.isActive ? "Alert activated" : "Alert deactivated");
      refreshAlerts();
    } catch {
      showToast("Couldn't update that alert. Please try again.");
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!window.confirm("Remove this price alert? This cannot be undone.")) return;
    try {
      await storage.removeAlert(id);
      showToast("Alert deleted");
      refreshAlerts();
    } catch {
      showToast("Couldn't delete that alert. Please try again.");
    }
  };

  const handleRearm = async (id: string) => {
    try {
      await storage.rearmAlert(id);
      showToast("Alert rearmed");
      refreshAlerts();
    } catch {
      showToast("Couldn't re-arm that alert. Please try again.");
    }
  };

  const handleSnoozeAlert = async (id: string, days: number) => {
    try {
      await storage.snoozeAlert(id, days);
      showToast(days === 0 ? "Alert resumed" : `Snoozed for ${days} day${days !== 1 ? "s" : ""}`);
      refreshAlerts();
    } catch {
      showToast("Couldn't snooze that alert. Please try again.");
    }
  };

  return { handleToggle, handleDeleteAlert, handleRearm, handleSnoozeAlert };
}
