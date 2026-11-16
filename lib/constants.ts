import {
  Bus,
  Camera,
  Castle,
  Hotel,
  Landmark,
  MapPin,
  ShoppingBag,
  Ticket,
  TreePine,
  Utensils,
  type LucideIcon,
} from "lucide-react"
import { CATEGORY_LABELS, type PlaceCategory } from "@/lib/domain/categories"
import { CATEGORY_COLORS } from "@/lib/domain/category-colors"

const ICONS: Record<PlaceCategory, LucideIcon> = {
  hospedagem: Hotel,
  gastronomia: Utensils,
  cultura: Landmark,
  historia: Castle,
  natureza: TreePine,
  compras: ShoppingBag,
  turismo: Camera,
  entretenimento: Ticket,
  transporte: Bus,
  outros: MapPin,
}

export type CategoryConfig = { color: string; icon: LucideIcon; label: string }

export function getCategoryConfig(category: string | undefined | null): CategoryConfig {
  const key: PlaceCategory = category && category in CATEGORY_COLORS ? (category as PlaceCategory) : "outros"
  return { color: CATEGORY_COLORS[key], icon: ICONS[key], label: CATEGORY_LABELS[key] }
}
