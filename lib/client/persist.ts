import type { Query } from "@tanstack/react-query"
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { del, get, set } from "idb-keyval"

// Offline reading (decision Q16): the trip list and trip details are persisted to
// IndexedDB for 7 days. Bump CACHE_BUSTER whenever the cached shape changes.

export const PERSIST_KEY = "tripplanner-query-cache"
export const CACHE_BUSTER = "schema-2"
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000

export const persister =
  typeof window === "undefined"
    ? undefined
    : createAsyncStoragePersister({
        storage: { getItem: (k) => get(k), setItem: (k, v) => set(k, v), removeItem: (k) => del(k) },
        key: PERSIST_KEY,
        throttleTime: 1000,
      })

/** Only trip data is kept offline (not chat, share links or anything else). */
export const shouldPersistQuery = (query: Query) =>
  query.state.status === "success" && (query.queryKey[0] === "trips" || query.queryKey[0] === "trip")

export async function clearPersistedCache() {
  if (typeof window !== "undefined") await del(PERSIST_KEY)
}
