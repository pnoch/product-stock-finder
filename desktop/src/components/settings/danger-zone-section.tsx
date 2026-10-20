import { useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccount, type User } from "../../hooks/use-auth";
import { storage } from "../../storage";

export function DangerZoneSection({
  isAuthenticated,
  user,
  showToast,
  onSignOut,
}: {
  isAuthenticated: boolean;
  user: User | null;
  showToast: (message: string) => void;
  onSignOut: () => void;
}) {
  const [clearConfirm, setClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleClearAllData = async () => {
    try {
      await storage.clearAllData();
      setClearConfirm(false);
      window.location.reload();
    } catch (e) {
      // A storage failure must not reject unhandled with no feedback.
      showToast(
        e instanceof Error ? e.message : "Couldn't clear data. Please try again.",
      );
      setClearConfirm(false);
    }
  };

  const handleDeleteAccount = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      try {
        onSignOut();
      } catch {
        // token is removed by the wipe below regardless
      }
      await storage.clearAllData();
      window.location.reload();
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Server account deletion failed",
      );
    } finally {
      setDeleting(false);
    }
  }, [deleting, onSignOut]);

  const deleteExpected = user?.email ?? "DELETE";
  const isDeleteConfirmed =
    user?.email != null
      ? deleteConfirmEmail.trim().toLowerCase() === deleteExpected.toLowerCase()
      : deleteConfirmEmail.trim() === deleteExpected;

  return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Danger Zone</h2>
        {isAuthenticated && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {/* A signed-in device re-syncs: clearing the local cursor makes the
                next sync pull everything back, so the button looked broken. */}
            Signed in: this clears this device&apos;s copy only. Your account&apos;s data
            stays on the server and re-syncs — use &quot;Delete Account &amp; Data&quot;
            to remove it everywhere.
          </p>
        )}
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Clear all data"
          >
            <Trash2 className="w-4 h-4" /> Clear All Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 dark:text-red-400">
              Are you sure?
            </span>
            <button
              onClick={handleClearAllData}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Confirm clear all data"
            >
              Yes, clear all
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              disabled={deleting}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Cancel clear all data"
            >
              Cancel
            </button>
          </div>
        )}
          {isAuthenticated && user && (
            <div className="mt-4">
              {!deleteConfirm ? (
                <button
                  onClick={() => { setDeleteConfirmEmail(""); setDeleteConfirm(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  aria-label="Delete account and data"
                >
                  <Trash2 className="w-4 h-4" /> Delete Account & Data
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    This permanently deletes your server account and all local data. This cannot be undone.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.email
                      ? `Type your email (${user.email}) to confirm.`
                      : "Type DELETE to confirm."}
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    placeholder={user?.email ? "Your email address" : "DELETE"}
                    className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    aria-label="Type to confirm account deletion"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || !isDeleteConfirmed}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                      aria-label="Confirm delete account and data"
                    >
                      {deleting ? "Deleting" : "Yes, delete everything"}
                    </button>
                    <button
                      onClick={() => { setDeleteConfirmEmail(""); setDeleteConfirm(false); }}
                      disabled={deleting}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                      aria-label="Cancel delete account and data"
                    >
                      Cancel
                    </button>
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{deleteError}</p>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

  );
}
