import { useState } from "react";

export function useShareWatchlist({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleShareWatchlist = async () => {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const client = (await import("../lib/trpc")).createTRPCClient();
      const res = await client.sharedWatchlists.create.mutate({});
      setShareUrl(res.shareUrl);
      try {
        await navigator.clipboard.writeText(res.shareUrl);
        showToast("Share link copied");
      } catch {
        showToast("Share link created");
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  return { shareUrl, sharing, shareError, handleShareWatchlist };
}
