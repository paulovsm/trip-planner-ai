import { Check } from "lucide-react"
import { getCategoryConfig } from "@/lib/constants"
import type { PlaceCategory } from "@/lib/domain/categories"
import { VISITED_COLOR } from "@/lib/domain/category-colors"
import { cn } from "@/lib/utils"

/** Round category marker (icon, or the Stop number), matching the map pins. */
export function CategoryBadge({
  category,
  visited,
  number,
  className,
}: {
  category: PlaceCategory
  visited?: boolean
  number?: number
  className?: string
}) {
  const { color, icon: Icon, label } = getCategoryConfig(category)
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", className)}
      style={{ backgroundColor: visited ? VISITED_COLOR : color }}
      title={label}
    >
      {visited ? <Check className="size-4" aria-label="Visitado" /> : number ? number : <Icon className="size-4" aria-hidden />}
    </span>
  )
}
