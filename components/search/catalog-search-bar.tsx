import { useEffect, useRef, useState } from "react";
import { Platform, View, TouchableOpacity, TextInput, Keyboard, Animated } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface CatalogSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
}

export function CatalogSearchBar({
  query,
  onQueryChange,
  onSearchSubmit,
}: CatalogSearchBarProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [focused, borderAnim]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
      }}
    >
      <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search by model number or brand..."
        placeholderTextColor={colors.muted}
        style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
        autoFocus={false}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => {
          Keyboard.dismiss();
          onSearchSubmit?.(query.trim());
        }}
      />
      {query.length > 0 && (
        <TouchableOpacity activeOpacity={0.7} onPress={() => onQueryChange("")} accessibilityLabel="Clear search" accessibilityRole="button">
          <IconSymbol
            name="xmark.circle.fill"
            size={18}
            color={colors.muted}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
