import { useState } from "react";
import { storage } from "../storage";
import type { BackOrderReminder } from "../../../lib/types";

export function useReminderReschedule({
  setReminders,
  showToast,
}: {
  setReminders: (reminders: BackOrderReminder[]) => void;
  showToast: (message: string) => void;
}) {
  const [rescheduleTarget, setRescheduleTarget] = useState<BackOrderReminder | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const openReschedule = (r: BackOrderReminder) => {
    setRescheduleTarget(r);
    const d = new Date(r.reminderDate);
    const iso = isNaN(d.getTime()) ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
    setRescheduleDate(iso);
    setRescheduleError(null);
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    const picked = new Date(rescheduleDate + "T12:00:00");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (isNaN(picked.getTime()) || picked.getTime() < startOfToday.getTime()) {
      setRescheduleError("Please select today or a future date.");
      return;
    }
    try {
      await storage.addBackOrderReminder({
        ...rescheduleTarget,
        reminderDate: picked.toISOString(),
      });
      const updated = await storage.getBackOrderReminders();
      setReminders(updated);
    } catch {
      setRescheduleError("Couldn't save the new date. Please try again.");
      return;
    }
    const label = picked.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    setRescheduleTarget(null);
    setRescheduleError(null);
    showToast(`Rescheduled to ${label}`);
  };

  return {
    rescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    rescheduleError,
    openReschedule,
    handleReschedule,
    closeReschedule: () => setRescheduleTarget(null),
  };
}
