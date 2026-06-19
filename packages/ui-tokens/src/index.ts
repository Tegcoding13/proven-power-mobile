// Provisional brand palette derived from the Proven Power logo (green/black/white).
// Replace `green` with the exact brand hex once a logo source file / brand guide is provided.
export const colors = {
  green: {
    50: "#EAF5EC",
    100: "#C9E5CE",
    300: "#6FAD7C",
    500: "#2D7A3A",
    600: "#256530",
    700: "#1D4F26",
    900: "#10301660",
  },
  black: "#111111",
  white: "#FFFFFF",
  gray: {
    50: "#F7F7F7",
    100: "#EDEDED",
    300: "#C9C9C9",
    500: "#8A8A8A",
    700: "#4A4A4A",
  },
  status: {
    success: "#2D7A3A",
    warning: "#C97A1A",
    danger: "#B3261E",
    info: "#1B6FA8",
  },
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
  spacing,
  radii,
  typeScale,
  minTouchTarget,
} as const;

export type Theme = typeof theme;
