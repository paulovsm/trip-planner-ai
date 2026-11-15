/** Canonical Place categories (stored value → pt-BR label). */
export const PLACE_CATEGORIES = [
  "hospedagem",
  "gastronomia",
  "cultura",
  "historia",
  "natureza",
  "compras",
  "turismo",
  "entretenimento",
  "transporte",
  "outros",
] as const

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  hospedagem: "Hospedagem",
  gastronomia: "Gastronomia",
  cultura: "Cultura",
  historia: "História",
  natureza: "Natureza",
  compras: "Compras",
  turismo: "Turismo",
  entretenimento: "Entretenimento",
  transporte: "Transporte",
  outros: "Outros",
}

// Free-text synonyms (as produced by users, imports or the AI) → canonical category.
const SYNONYMS: [string, PlaceCategory][] = [
  ["hospedagem", "hospedagem"],
  ["hotel", "hospedagem"],
  ["hostel", "hospedagem"],
  ["pousada", "hospedagem"],
  ["gastronomia", "gastronomia"],
  ["restaurante", "gastronomia"],
  ["comida", "gastronomia"],
  ["cafe", "gastronomia"],
  ["bar", "gastronomia"],
  ["cultura", "cultura"],
  ["museu", "cultura"],
  ["arte", "cultura"],
  ["teatro", "cultura"],
  ["historia", "historia"],
  ["monumento", "historia"],
  ["igreja", "historia"],
  ["castelo", "historia"],
  ["natureza", "natureza"],
  ["parque", "natureza"],
  ["praia", "natureza"],
  ["trilha", "natureza"],
  ["compras", "compras"],
  ["shopping", "compras"],
  ["mercado", "compras"],
  ["turismo", "turismo"],
  ["mirante", "turismo"],
  ["entretenimento", "entretenimento"],
  ["show", "entretenimento"],
  ["transporte", "transporte"],
  ["aeroporto", "transporte"],
  ["estacao", "transporte"],
]

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Maps any free-text category to a canonical one; unknown text becomes "outros". */
export function normalizeCategory(input: string | null | undefined): PlaceCategory {
  if (!input) return "outros"
  const text = stripAccents(input.toLowerCase().trim())
  if ((PLACE_CATEGORIES as readonly string[]).includes(text)) return text as PlaceCategory
  for (const [word, category] of SYNONYMS) {
    if (new RegExp(`\\b${word}`).test(text)) return category
  }
  return "outros"
}
