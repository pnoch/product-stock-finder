import { useEffect } from "react";
import { UserCircle } from "lucide-react";
import { useAuth, buildLoginUrl, refreshCurrentUser } from "../../hooks/use-auth";
import { useAccountSync } from "../../hooks/use-account-sync";
import { useEmailAuth } from "../../hooks/use-email-auth";
import { usePasswordChange } from "../../hooks/use-password-change";
import { SignedInAccountCard } from "./SignedInAccountCard";
import { SignedOutAccountCard } from "./SignedOutAccountCard";

export function AccountSection({
  now,
  showToast,
}: {
  now: number;
  showToast: (message: string) => void;
}) {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { syncStatus, syncStatusClass, syncing, syncMessage, handleSyncNow } =
    useAccountSync({ isAuthenticated, now });
  const emailAuth = useEmailAuth({ showToast });
  const password = usePasswordChange({ showToast });

  useEffect(() => {
    void refreshCurrentUser();
    const onFocus = () => void refreshCurrentUser();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const handleSignIn = async () => {
    await login(await buildLoginUrl());
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-4">
        <UserCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h2 className="text-lg font-semibold">Account</h2>
      </div>
      {isAuthenticated && user ? (
        <SignedInAccountCard
          user={user}
          syncStatus={syncStatus}
          syncStatusClass={syncStatusClass}
          syncMessage={syncMessage}
          syncing={syncing}
          onSyncNow={() => void handleSyncNow()}
          onLogout={logout}
          password={password}
        />
      ) : (
        <SignedOutAccountCard
          syncStatus={syncStatus}
          syncStatusClass={syncStatusClass}
          onSignIn={() => void handleSignIn()}
          emailAuth={emailAuth}
        />
      )}
    </div>
  );
}
