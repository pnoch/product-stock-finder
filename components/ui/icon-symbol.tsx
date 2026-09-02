// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolViewProps, SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";
type IconMapping = Record<
  SymbolViewProps["name"],
  ComponentProps<typeof MaterialIcons>["name"]
>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "arrow.clockwise": "refresh",
  "arrow.triangle.2.circlepath": "sync",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  calendar: "calendar-today",
  "crown.fill": "workspace-premium",
  "list.bullet": "format-list-bulleted",
  "bell.fill": "notifications",
  "bell": "notifications",
  "bell.badge.fill": "notification-important",
  "gearshape.fill": "settings",
  magnifyingglass: "search",
  iphone: "smartphone",
  plus: "add",
  "plus.circle.fill": "add-circle",
  globe: "language",
  "cart.fill": "shopping-cart",
  "star.fill": "star",
  "trash.fill": "delete",
  "square.and.arrow.up": "share",
  "square.and.arrow.down": "download",
  "clock.arrow.circlepath": "history",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
  "moon.zzz.fill": "bedtime",
  "moon.fill": "bedtime",
  "newspaper.fill": "article",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "exclamationmark.triangle.fill": "warning",
  "info.circle.fill": "info",
  "arrow.up.right.square": "open-in-new",
  "chart.line.uptrend.xyaxis": "trending-up",
  "tag.fill": "local-offer",
  "clock.fill": "access-time",
  "location.fill": "location-on",
  "dollarsign.circle.fill": "attach-money",
  "bell.slash.fill": "notifications-off",
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
  "heart.fill": "favorite",
  "bookmark.fill": "bookmark",
  ellipsis: "more-horiz",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  "chevron.left": "chevron-left",
  "arrow.left": "arrow-back",
  xmark: "close",
  checkmark: "check",
  minus: "remove",
  "circle.fill": "circle",
  "square.fill": "square",
  wifi: "wifi",
  network: "hub",
  cpu: "memory",
  "server.rack": "dns",
  "doc.on.doc": "content-copy",
  pencil: "edit",
  "person.crop.circle.fill": "account-circle",
  "person.crop.circle.badge.plus": "person-add",
  "arrow.left.arrow.right": "swap-horiz",
  "chart.bar.xaxis": "bar-chart",
  "square.and.pencil": "edit-note",
  "slider.horizontal.3": "tune",
  "wand.and.stars": "auto-fix-high",
  sparkles: "auto-awesome",
  "chart.bar.fill": "bar-chart",
  "envelope.fill": "mail",
  "exclamationmark.circle.fill": "error",
  "lightbulb.fill": "lightbulb",
  "line.3.horizontal.decrease.circle": "filter-list",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name] ?? "help-outline"}
      style={style}
    />
  );
}
