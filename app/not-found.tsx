import Link from "next/link"
import { MapPinOff } from "lucide-react"

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <MapPinOff className="text-muted-foreground size-10" />
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <Link href="/trips" className="text-primary font-medium underline">
        Ir para Minhas viagens
      </Link>
    </main>
  )
}
