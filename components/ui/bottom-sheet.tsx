import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { useColors } from "@/hooks/use-colors";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: number | `${number}%`;
  contentStyle?: ViewStyle;
  onShow?: () => void;
  testID?: string;
};

/**
 * One bottom-sheet shell: backdrop press, animation, keyboard avoidance,
 * safe-area padding, handle bar, and a header slot. Sheets should provide
 * content only.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeight = "70%",
  contentStyle,
  onShow,
  testID,
}: BottomSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const sheetAnim = useState(() => new Animated.Value(0))[0];
  const backdropAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!visible) {
      sheetAnim.setValue(0);
      backdropAnim.setValue(0);
      return;
    }
    if (reduceMotion) {
      sheetAnim.setValue(1);
      backdropAnim.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(sheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 68,
        friction: 11,
      }),
    ]).start();
  }, [visible, reduceMotion, sheetAnim, backdropAnim]);

  useEffect(() => {
    if (!visible) return;
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={onShow}
      testID={testID}
    >
      <Animated.View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: backdropAnim,
          paddingBottom: keyboardHeight,
        }}
        accessibilityViewIsModal
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <Animated.View
          style={[
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 24 + insets.bottom,
              maxHeight,
              opacity: sheetAnim,
              transform: [
                {
                  translateY: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [48, 0],
                  }),
                },
                {
                  scale: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
              ],
            },
            contentStyle,
          ]}
          accessibilityViewIsModal
        >
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>
          {title ? (
            <Text
              accessibilityRole="header"
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: subtitle ? 4 : 16,
              }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
          {children}
          {footer}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
