import Link from "next/link"
import { CloudOff } from "lucide-react"

export const metadata = { title: "Sem conexão" }
export const dynamic = "force-static"

/** Shown by the service worker when a page that was never opened is requested offline. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <CloudOff className="text-muted-foreground size-10" />
      <h1 className="text-xl font-semibold">Você está sem conexão</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        As viagens que você abriu recentemente continuam disponíveis offline. Abra a lista para ver o que já está salvo
        neste aparelho.
      </p>
      <Link href="/trips" className="text-primary font-medium underline">
        Minhas viagens
      </Link>
    </main>
  )
}
