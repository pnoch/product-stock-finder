// Desktop build stub for react-native — shared lib modules import a few
// symbols (Platform, Alert, Linking) that desktop code never renders.
export const Platform = {
  OS: "web" as const,
  select: <T,>(options: { default: T } & Partial<Record<string, T>>): T =>
    (options.web ?? options.default),
};

export const Alert = {
  alert: (
    _title: string,
    _message?: string,
    buttons?: Array<{ onPress?: () => void; style?: string }>,
  ) => {
    const confirm = buttons?.find((b) => b.style !== "cancel");
    if (window.confirm(_message ?? _title)) confirm?.onPress?.();
  },
};

export const Linking = {
  openURL: (url: string) => window.open(url, "_blank"),
};

export const AsyncStorage = {};

// expo-modules-core's requireNativeModule imports these from react-native.
// Desktop never loads native modules — dead exports satisfy the bundler.
export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => null,
};
export const NativeModulesProxy = {};
export const NativeModules = {};
export const NativeEventEmitter = class {
  addListener() {
    return { remove: () => {} };
  }
  removeAllListeners() {};
};
// expo package HMR path (dev only) imports this singleton.
export const DeviceEventEmitter = new NativeEventEmitter();
export const PixelRatio = {
  get: () => 1,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (n: number) => n,
  roundToNearestPixel: (n: number) => n,
};
export const Dimensions = {
  get: () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};
export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  hairlineWidth: 1,
  flatten: (style: unknown) => style,
};
export const AppRegistry = {
  registerComponent: () => {},
  getApplication: () => ({ element: null }),
};
export const I18nManager = {
  isRTL: false,
  allowRTL: () => {},
  forceRTL: () => {},
};
export const InteractionManager = {
  runAfterInteractions: (cb: () => void) => {
    cb();
    return { cancel: () => {} };
  },
};
export const Vibration = { vibrate: () => {}, cancel: () => {} };

// Generic component stubs — expo packages occasionally import RN primitives.
// Desktop never renders these; identity components satisfy the bundler.
function passthrough(props: { children?: unknown }) {
  return props.children ?? null;
}
export const View = passthrough;
export const Text = passthrough;
export const ScrollView = passthrough;
export const Pressable = passthrough;
export const TouchableOpacity = passthrough;
export const Image = passthrough;
export const ActivityIndicator = () => null;
export const LogBox = {
  ignoreLogs: () => {},
  ignoreAllLogs: () => {},
  install: () => {},
};