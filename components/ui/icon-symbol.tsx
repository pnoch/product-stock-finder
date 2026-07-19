// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "list.bullet": "format-list-bulleted",
  "bell.fill": "notifications",
  "gearshape.fill": "settings",
  "magnifyingglass": "search",
  "plus": "add",
  "arrow.clockwise": "refresh",
  "globe": "language",
  "cart.fill": "shopping-cart",
  "star.fill": "star",
  "trash.fill": "delete",
  "square.and.arrow.up": "share",
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
  "ellipsis": "more-horiz",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  "chevron.left": "chevron-left",
  "arrow.left": "arrow-back",
  "xmark": "close",
  "checkmark": "check",
  "minus": "remove",
  "circle.fill": "circle",
  "square.fill": "square",
  "wifi": "wifi",
  "network": "hub",
  "cpu": "memory",
  "server.rack": "dns",
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
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
