import { EmptyStateView } from "@/components/ui/empty-state-view";

export function AlertsListEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyStateView
      icon="bell.fill"
      title="No alerts set"
      subtitle='Open a product and tap "Set Alert" to get notified when it restocks or the price drops.'
      ctaLabel="Browse Products"
      onCtaPress={onBrowse}
    />
  );
}
