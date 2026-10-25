import { Info } from "lucide-react";
import packageJson from "../../../package.json";
import {
  getPrivacyPolicyUrl,
  getSupportMailtoUrl,
} from "../../../../lib/legal-links";
import { externalLinkHandler } from "../../lib/open-external";
import { AppUpdatesRow } from "./app-updates-row";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function AboutSection({
  deferredPrompt,
  onInstall,
}: {
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstall: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-4">
        <Info className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h2 className="text-lg font-semibold">About</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium">Version</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              OmniShop
            </p>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {packageJson.version}
          </span>
        </div>
        <AppUpdatesRow />
        {deferredPrompt && (
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium">Install app</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add to home screen for offline access
              </p>
            </div>
            <button
              onClick={onInstall}
              className="ml-2 shrink-0 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700"
              aria-label="Install app"
            >
              Install
            </button>
          </div>
        )}
        <div className="flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium">Contact Support</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Get help with the app
            </p>
          </div>
          <a
            href={getSupportMailtoUrl()}
            onClick={externalLinkHandler(getSupportMailtoUrl())}
            className="ml-2 shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            aria-label="Contact support"
          >
            Email us
          </a>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium">Privacy Policy</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              How we handle your data
            </p>
          </div>
          {getPrivacyPolicyUrl() ? (
            <a
              href={getPrivacyPolicyUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={externalLinkHandler(getPrivacyPolicyUrl())}
              className="ml-2 shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              aria-label="Open privacy policy"
            >
              View
            </a>
          ) : (
            <span
              className="ml-2 shrink-0 text-xs text-gray-400"
              aria-label="Privacy policy not configured"
            >
              Not configured
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
