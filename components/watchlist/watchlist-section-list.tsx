import type { ReactElement } from "react";
import { RefreshControl, SectionList } from "react-native";
import type { Product } from "@/lib/types";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;
type Section = { key: string; title: string; products: Product[] };

export function WatchlistSectionList({
  sectionData,
  groupMode,
  isRefreshingAny,
  refreshAll,
  colors,
  listHeader,
  listEmpty,
  renderSectionHeader,
  renderItem,
}: {
  sectionData: (Section & { data: (Product & { _sectionKey?: string })[] })[];
  groupMode: string;
  isRefreshingAny: boolean;
  refreshAll: () => Promise<unknown> | void;
  colors: Colors;
  listHeader: ReactElement;
  listEmpty: ReactElement;
  renderSectionHeader: (info: { section: Section }) => ReactElement | null;
  renderItem: (info: { item: Product & { _sectionKey?: string } }) => ReactElement | null;
}) {
  return (
    <SectionList
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={true}
      scrollEventThrottle={16}
      removeClippedSubviews={false}
      sections={sectionData}
      keyExtractor={(item: Product & { _sectionKey?: string }) => `${item.id}-${item._sectionKey ?? ""}`}
      extraData={groupMode}
      initialNumToRender={8}
      windowSize={7}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={50}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 24,
        flexGrow: 1,
      }}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingAny}
          onRefresh={() => void refreshAll()}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
          titleColor={colors.muted}
        />
      }
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
    />
  );
}
