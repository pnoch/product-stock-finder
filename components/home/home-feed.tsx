import { View } from "react-native";
import {
  AlertFiredCard,
  DropCard,
  QuietCard,
  RestockCard,
} from "@/components/home/feed-card";
import type { FeedItem } from "@/lib/home-feed";

export function HomeFeed({
  feedItems,
  productNames,
  onViewProduct,
  onRearm,
}: {
  feedItems: FeedItem[];
  productNames: Map<string, string>;
  onViewProduct: (productId: string) => void;
  onRearm: (alertId: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      {feedItems.map((item) => {
        switch (item.kind) {
          case "alerts":
            return (
              <AlertFiredCard
                key="alerts"
                alerts={item.alerts}
                names={productNames}
                onView={onViewProduct}
                onRearm={onRearm}
              />
            );
          case "drops":
            return <DropCard key="drops" drops={item.drops} />;
          case "restocks":
            return (
              <RestockCard
                key="restocks"
                productIds={item.productIds}
                names={item.names}
                onView={onViewProduct}
              />
            );
          case "quiet":
            return <QuietCard key="quiet" dropCount={item.dropCount} />;
        }
      })}
    </View>
  );
}
