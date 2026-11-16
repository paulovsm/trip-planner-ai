import { notFound } from "next/navigation"
import { brandIcon } from "@/lib/brand-icon"

const VARIANTS: Record<string, () => Response> = {
  "192": () => brandIcon(192),
  "512": () => brandIcon(512),
  "maskable-512": () => brandIcon(512, { padding: 0.12, rounded: false }),
}

export const dynamic = "force-static"
export const generateStaticParams = () => Object.keys(VARIANTS).map((size) => ({ size }))

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params
  const render = VARIANTS[size]
  if (!render) notFound()
  return render()
}
