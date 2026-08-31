import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import {
  Animated,
  Text,
  View,
  Platform,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type ToastType = "success" | "info" | "error";

type ToastState = {
  message: string;
  type: ToastType;
  visible: boolean;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (_msg: string) => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "success",
    visible: false,
  });
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, type, visible: true });
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setToast((prev) => ({ ...prev, visible: false })));
      }, 3000);
    },
    [opacity, translateY],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const bgColor =
    toast.type === "success"
      ? colors.foreground
      : toast.type === "error"
        ? colors.error
        : colors.primary;

  const textColor = "#fff";
  const iconName =
    toast.type === "success"
      ? "checkmark.circle.fill"
      : toast.type === "error"
        ? "exclamationmark.circle.fill"
        : "info.circle.fill";

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.visible && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: Platform.OS === "web" ? 24 : 36,
            opacity,
            transform: [{ translateY }],
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <View
            style={{
              backgroundColor: bgColor,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
              maxWidth: 480,
            }}
          >
            <IconSymbol name={iconName as never} size={20} color={textColor} />
            <Text
              style={{ color: textColor, fontSize: 14, fontWeight: "600", flexShrink: 1 }}
              numberOfLines={2}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
