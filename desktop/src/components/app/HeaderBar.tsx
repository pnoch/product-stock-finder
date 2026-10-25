import { useNavigate } from "react-router";
import { ConnectionBadge } from "../ConnectionBadge";
import { useConnection } from "../../hooks/use-connection";

export function HeaderBar() {
  const connection = useConnection();
  const navigate = useNavigate();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
  const searchHint = isMac ? "⌘K" : "Ctrl+K";
  return (
    <div className="h-14 shrink-0 hidden lg:flex items-center px-6 border-b border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm sticky top-0 z-10">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        OmniShop
      </span>
      <div className="ml-auto flex items-center gap-3">
        <ConnectionBadge
          status={connection.status}
          onPress={
            connection.status === "signed-out"
              ? () => navigate("/settings")
              : undefined
          }
        />
        <span
          className="text-xs text-gray-400 dark:text-gray-500"
          title={`Press ${searchHint} to search — ${isMac ? "Cmd" : "Ctrl"}+K, ${isMac ? "Cmd" : "Ctrl"}+, for settings, ${isMac ? "Cmd" : "Ctrl"}+Shift+T to toggle theme`}
          aria-label={`Keyboard shortcuts: ${searchHint} search, ${isMac ? "Cmd" : "Ctrl"} comma settings, ${isMac ? "Cmd" : "Ctrl"} Shift T toggle theme`}
        >
          Press {searchHint} to search
        </span>
      </div>
    </div>
  );
}
