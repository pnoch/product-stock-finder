/** @type {const} */
const themeColors = {
  primary: { light: "#0F52BA", dark: "#3B7DD8" },
  background: { light: "#F8FAFC", dark: "#0A0E1A" },
  surface: { light: "#FFFFFF", dark: "#131929" },
  foreground: { light: "#0F172A", dark: "#F1F5F9" },
  muted: { light: "#64748B", dark: "#94A3B8" },
  border: { light: "#E2E8F0", dark: "#1E2D4A" },
  success: { light: "#00C896", dark: "#00C896" },
  warning: { light: "#F59E0B", dark: "#FBBF24" },
  error: { light: "#EF4444", dark: "#F87171" },
  card: { light: "#FFFFFF", dark: "#161E33" },
  tint: { light: "#0F52BA", dark: "#3B7DD8" },
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
};

const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
  full: 9999,
};

module.exports = { themeColors, spacing, radius };
