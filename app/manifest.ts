import type { MetadataRoute } from "next"
import { BRAND_COLOR } from "@/lib/brand-icon"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TripPlanner",
    short_name: "TripPlanner",
    description: "Roteiro por dia, mapa, percursos e assistente de IA para suas viagens.",
    id: "/trips",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#ffffff",
    theme_color: BRAND_COLOR,
    categories: ["travel", "navigation"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
