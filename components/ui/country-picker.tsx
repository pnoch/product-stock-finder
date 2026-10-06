import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputChangeEventData,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { searchCountries } from "@shared/countries";

export function CountryPicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value?: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchCountries(query), [query]);

  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  const handleQueryChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    const target = (e as unknown as { target?: { value?: string } }).target;
    setQuery(e.nativeEvent?.text ?? target?.value ?? "");
  };

  const handleSelect = (code: string) => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(code);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        accessibilityViewIsModal
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "85%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Choose country
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{ padding: 4 }}
              accessibilityLabel="Close country picker"
              accessibilityRole="button"
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={24}
                color={colors.muted}
              />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              marginBottom: 12,
            }}
          >
            <IconSymbol
              name="magnifyingglass"
              size={18}
              color={colors.muted}
            />
            <TextInput
              value={query}
              onChange={handleQueryChange}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Search countries"
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                paddingVertical: 10,
                color: colors.foreground,
                fontSize: 14,
              }}
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ marginTop: 4 }}
          >
            {results.length === 0 ? (
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  textAlign: "center",
                  paddingVertical: 24,
                }}
              >
                No countries found
              </Text>
            ) : (
              results.map((country) => {
                const selected = country.code === value;
                return (
                  <Pressable
                    key={country.code}
                    onPress={() => handleSelect(country.code)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      marginBottom: 6,
                      backgroundColor: selected
                        ? colors.primary
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                    }}
                    accessibilityLabel={`Select ${country.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={{
                        color: selected ? "#fff" : colors.foreground,
                        fontSize: 15,
                        fontWeight: "600",
                      }}
                    >
                      {country.name}
                    </Text>
                    <Text
                      style={{
                        color: selected ? "#fff" : colors.muted,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {country.code}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
