"use client"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Algo deu errado</h1>
          <button onClick={reset} style={{ marginTop: 16, minHeight: 44, padding: "0 16px" }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
