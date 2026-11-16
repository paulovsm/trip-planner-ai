"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { signOut } from "next-auth/react"
import { clearPersistedCache } from "@/lib/client/persist"

/** Signs out and wipes cached trip data (memory + offline storage) from this device. */
export function useSignOut() {
  const qc = useQueryClient()
  return useCallback(async () => {
    qc.clear()
    await clearPersistedCache()
    await signOut({ callbackUrl: "/" })
  }, [qc])
}
