"use client"

import { useState } from "react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { api } from "@/lib/client/api"
import { VISITED_MUTATION_KEY, type VisitedVars } from "@/hooks/use-trip-mutations"

export function makeQueryClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, err) => count < 2 && (err as { status?: number })?.status === undefined,
      },
    },
  })
  // Registered as a default so a mutation paused offline can resume after a reload.
  qc.setMutationDefaults(VISITED_MUTATION_KEY, {
    mutationFn: ({ tripId, placeId, visited }: VisitedVars) => api.places.update(tripId, placeId, { visited }),
  })
  return qc
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient)

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
