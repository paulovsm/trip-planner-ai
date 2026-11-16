import { Link2Off } from "lucide-react"

export default function SharedNotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <Link2Off className="text-muted-foreground size-10" />
      <h1 className="text-xl font-semibold">Link inválido ou expirado</h1>
      <p className="text-muted-foreground max-w-sm text-sm">Peça um novo link para quem compartilhou a viagem com você.</p>
    </main>
  )
}
