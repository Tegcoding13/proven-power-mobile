// Premium dark-forest-green brand palette, derived from the Proven Power logo
// but deepened for a modern app shell (hero gradients, dark headers).
// Replace `green` with the exact brand hex once a logo source file / brand guide is provided.
export const colors = {
  green: {
    50: "#E8F3EE",
    100: "#C5E0D2",
    300: "#5FA382",
    500: "#0B5D3B",
    600: "#094B30",
    700: "#073923",
    900: "#042217",
  },
  black: "#111111",
  white: "#FFFFFF",
  gray: {
    50: "#F7F8F8",
    100: "#EDEFEE",
    300: "#C9CDCB",
    500: "#8A9290",
    700: "#4A524F",
  },
  status: {
    success: "#0B5D3B",
    warning: "#C97A1A",
    danger: "#B3261E",
    info: "#1B6FA8",
  },
} as const;

// Hero/header gradient — dark forest green, deepening toward the bottom.
export const gradients = {
  hero: [colors.green[500], colors.green[900]] as [string, string],
} as const;

// Platform-agnostic "soft shadow" presets. React Native (iOS) reads the
// shadow* keys; Android needs `elevation`; web/Next.js should use boxShadow
// instead (see packages/ui-tokens's README note in this file).
export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  raised: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;

// CSS box-shadow equivalents of the presets above, for web.
export const boxShadows = {
  card: "0 4px 12px rgba(0, 0, 0, 0.08)",
  raised: "0 8px 20px rgba(0, 0, 0, 0.14)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Minimum touch target size per the glove-friendly / outdoor-use requirement.
export const minTouchTarget = 48;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typeScale = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const theme = {
  colors,
  gradients,
  shadows,
  boxShadows,
  spacing,
  radii,
  typeScale,
  minTouchTarget,
} as const;

export type Theme = typeof theme;
