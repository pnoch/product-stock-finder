import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { hasSeenOnboarding, setOnboardingSeen } from "../../../lib/onboarding";

const SLIDES = [
  {
    emoji: "🛒",
    title: "Track Prices Everywhere",
    body: "Monitor products across 25 global distributors in one watchlist.",
  },
  {
    emoji: "✨",
    title: "Add Anything",
    body: "Search the catalog, paste a list of model numbers, or add any product manually with AI.",
  },
  {
    emoji: "🔔",
    title: "Never Miss a Drop",
    body: "Price alerts, restock watches, and weekly digests keep you ahead.",
  },
];

const localStore = {
  getItem: (k: string) => Promise.resolve(localStorage.getItem(k)),
  setItem: (k: string, v: string): Promise<void> => {
    localStorage.setItem(k, v);
    return Promise.resolve();
  },
};

export function useOnboardingModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await hasSeenOnboarding(localStore);
        if (!cancelled && !seen) setOpen(true);
      } catch {
        // treat as seen — never block
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const complete = useCallback(async () => {
    setOpen(false);
    try {
      await setOnboardingSeen(localStore);
    } catch {
      // best-effort
    }
  }, []);
  return { open, complete };
}

export function OnboardingModal({
  open,
  onComplete,
  onClose,
}: {
  open: boolean;
  onComplete?: () => void;
  onClose?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const done = onComplete ?? onClose ?? (() => {});
  return (
    <Modal open={open} onClose={done} title="Welcome">
      <div className="flex flex-col items-center text-center">
        <div className="text-5xl mb-4" aria-hidden="true">
          {slide.emoji}
        </div>
        <h3 className="text-xl font-semibold mb-2">{slide.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{slide.body}</p>
        <div className="flex items-center gap-2 mb-6" aria-label="Onboarding progress">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              className={`h-2 rounded-full transition-all ${
                i === index
                  ? "w-6 bg-brand-600"
                  : "w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={done}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
            )}
            {last ? (
              <button
                type="button"
                onClick={done}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Get started
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
