import { Platform } from "react-native";
import * as Font from "expo-font";

import themeConfig from "@/theme.config";

export type ColorScheme = "light" | "dark";

export const ThemeColors = themeConfig.themeColors;
export const Spacing = (themeConfig as unknown as { spacing: Record<string, number> }).spacing ?? {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
};
export const Radius = (themeConfig as unknown as { radius: Record<string, number> }).radius ?? {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
  full: 9999,
};

type ThemeColorTokens = typeof ThemeColors;
type ThemeColorName = keyof ThemeColorTokens;
type SchemePalette = Record<ColorScheme, Record<ThemeColorName, string>>;
type SchemePaletteItem = SchemePalette[ColorScheme];

function buildSchemePalette(colors: ThemeColorTokens): SchemePalette {
  const palette: SchemePalette = {
    light: {} as SchemePalette["light"],
    dark: {} as SchemePalette["dark"],
  };

  (Object.keys(colors) as ThemeColorName[]).forEach((name) => {
    const swatch = colors[name];
    palette.light[name] = swatch.light;
    palette.dark[name] = swatch.dark;
  });

  return palette;
}

export const SchemeColors = buildSchemePalette(ThemeColors);

type RuntimePalette = SchemePaletteItem & {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
};

function buildRuntimePalette(scheme: ColorScheme): RuntimePalette {
  const base = SchemeColors[scheme];
  return {
    ...base,
    text: base.foreground,
    background: base.background,
    tint: base.primary,
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: base.primary,
    border: base.border,
  };
}

export const Colors = {
  light: buildRuntimePalette("light"),
  dark: buildRuntimePalette("dark"),
} satisfies Record<ColorScheme, RuntimePalette>;

export type ThemeColorPalette = (typeof Colors)[ColorScheme];

export const Fonts = Platform.select({
  ios: {
    /** Inter aligned across iOS/web — iOS uses Inter via expo-font, falls back to system-ui */
    sans: "Inter, system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** Inter rounded fallback — aligns with web Inter */
    rounded: "Inter, ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "Inter, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export async function loadThemeFonts(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    // Inter on native is loaded via expo-font. Web resolves via CSS stack (Inter, system-ui).
    // When a local Inter asset is added, replace the block below with:
    // await Font.loadAsync({ Inter: require("@/assets/fonts/Inter-Regular.ttf") });
    await Font.loadAsync({});
  } catch {
    // Best-effort — fall back to system font stack
  }
}

export const InterFontFamily = "Inter";
