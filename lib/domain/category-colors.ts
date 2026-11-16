import type { PlaceCategory } from "./categories"

/**
 * One solid color per category, used for map pins, chips and accents. Every color
 * keeps white text/icons at WCAG AA (≥ 4.5:1) — enforced by category-colors.test.ts.
 */
export const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  hospedagem: "#BE123C",
  gastronomia: "#C2410C",
  cultura: "#6D28D9",
  historia: "#92400E",
  natureza: "#047857",
  compras: "#BE185D",
  turismo: "#155E75",
  entretenimento: "#A21CAF",
  transporte: "#1D4ED8",
  outros: "#475569",
}

/** Muted color for visited places. Also AA with white. */
export const VISITED_COLOR = "#4B5563"
