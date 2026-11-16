import { brandIcon } from "@/lib/brand-icon"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  // iOS applies its own rounding mask.
  return brandIcon(180, { rounded: false })
}
