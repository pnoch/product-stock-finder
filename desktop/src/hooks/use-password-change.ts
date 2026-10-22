import { useState } from "react";
import {
  changePassword,
  resendVerification,
  validatePasswordChange,
} from "./use-auth";

export function usePasswordChange({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [resending, setResending] = useState(false);

  const handleChangePassword = async () => {
    const validationError = validatePasswordChange(currentPw, newPw, confirmPw);
    if (validationError) {
      setChangeError(validationError);
      return;
    }
    setChanging(true);
    setChangeError(null);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      showToast("Password changed");
    } catch (e) {
      setChangeError(e instanceof Error ? e.message : "Change password failed");
    } finally {
      setChanging(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendVerification();
      showToast("Verification email sent — check your inbox.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setResending(false);
    }
  };

  return {
    currentPw,
    setCurrentPw,
    newPw,
    setNewPw,
    confirmPw,
    setConfirmPw,
    changeError,
    changing,
    handleChangePassword,
    resending,
    handleResend,
  };
}
