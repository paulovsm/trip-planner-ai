"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function TripsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error])
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar esta tela</h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
        <Button asChild>
          <Link href="/trips">Minhas viagens</Link>
        </Button>
      </div>
    </main>
  )
}
