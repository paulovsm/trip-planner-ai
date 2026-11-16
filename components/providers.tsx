"use client"

import { useState } from "react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { api } from "@/lib/client/api"
import { CACHE_BUSTER, PERSIST_MAX_AGE, persister, shouldPersistQuery } from "@/lib/client/persist"
import { VISITED_MUTATION_KEY, type VisitedVars } from "@/hooks/use-trip-mutations"
import { ServiceWorkerRegister } from "./sw-register"

export function makeQueryClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Keep data at least as long as it is persisted for offline reading.
        gcTime: PERSIST_MAX_AGE,
        retry: (count, err) => count < 2 && (err as { status?: number })?.status === undefined,
      },
      // Offline scope is "read + mark visited" (decision Q16): other edits fail fast
      // with a clear message instead of silently queueing.
      mutations: { networkMode: "always" },
    },
  })
  // Registered as a default so a "visited" change made offline is paused, persisted,
  // and resumed after a reload when the connection returns.
  qc.setMutationDefaults(VISITED_MUTATION_KEY, {
    networkMode: "online",
    mutationFn: ({ tripId, placeId, visited }: VisitedVars) => api.places.update(tripId, placeId, { visited }),
  })
  return qc
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient)

  const content = (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        {children}
        <ServiceWorkerRegister />
      </SessionProvider>
    </ThemeProvider>
  )

  if (!persister) return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
          shouldDehydrateMutation: (m) => m.state.isPaused && m.options.mutationKey?.[0] === VISITED_MUTATION_KEY[0],
        },
      }}
      onSuccess={() => queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())}
    >
      {content}
    </PersistQueryClientProvider>
  )
}
