import type { ChatMessageView, CreatedShareLink, MemberView, ShareLinkView, TripDetail, TripSummary } from "@/lib/domain/dto"
export type { ChatMessageView }

export type ChatEvent =
  | { type: "status"; text: string }
  | { type: "text"; delta: string }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "done"; message: ChatMessageView }
  | { type: "error"; message: string }
import type { ImportPreview } from "@/lib/domain/import"
import type { ProposalView } from "@/lib/domain/proposals"
import type {
  AddStopInput,
  CreateDayInput,
  CreatePlaceInput,
  CreateTripInput,
  Day,
  Place,
  Route,
  Trip,
  UpdateDayInput,
  UpdatePlaceInput,
  UpdateStopInput,
  UpdateTripInput,
} from "@/lib/domain/schemas"

/** Error thrown for non-2xx API responses, carrying the server's pt-BR message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData
  const res = await fetch(path, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.error ?? {}
    throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message ?? "Erro inesperado. Tente novamente.", err.details)
  }
  return data as T
}

const t = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}`
const d = (tripId: string, dayId: string) => `${t(tripId)}/days/${encodeURIComponent(dayId)}`

export type CommitImportInput = { places: CreatePlaceInput[]; days: { date: string; placeIndexes: number[] }[] }

export const api = {
  trips: {
    list: () => request<TripSummary[]>("GET", "/api/trips"),
    create: (input: CreateTripInput) => request<Trip>("POST", "/api/trips", input),
    get: (tripId: string) => request<TripDetail>("GET", t(tripId)),
    update: (tripId: string, input: UpdateTripInput) => request<void>("PATCH", t(tripId), input),
    remove: (tripId: string) => request<void>("DELETE", t(tripId)),
  },
  members: {
    invite: (tripId: string, email: string) => request<MemberView[]>("POST", `${t(tripId)}/members`, { email }),
    remove: (tripId: string, email: string) =>
      request<MemberView[]>("DELETE", `${t(tripId)}/members/${encodeURIComponent(email)}`),
  },
  places: {
    create: (tripId: string, input: CreatePlaceInput) => request<Place>("POST", `${t(tripId)}/places`, input),
    update: (tripId: string, placeId: string, input: UpdatePlaceInput) =>
      request<Place>("PATCH", `${t(tripId)}/places/${encodeURIComponent(placeId)}`, input),
    remove: (tripId: string, placeId: string) =>
      request<void>("DELETE", `${t(tripId)}/places/${encodeURIComponent(placeId)}`),
  },
  days: {
    create: (tripId: string, input: CreateDayInput) => request<Day>("POST", `${t(tripId)}/days`, input),
    update: (tripId: string, dayId: string, input: UpdateDayInput) => request<Day>("PATCH", d(tripId, dayId), input),
    remove: (tripId: string, dayId: string) => request<void>("DELETE", d(tripId, dayId)),
    addStop: (tripId: string, dayId: string, input: AddStopInput) =>
      request<Day>("POST", `${d(tripId, dayId)}/stops`, input),
    updateStop: (tripId: string, dayId: string, stopId: string, input: UpdateStopInput) =>
      request<Day[]>("PATCH", `${d(tripId, dayId)}/stops/${encodeURIComponent(stopId)}`, input),
    removeStop: (tripId: string, dayId: string, stopId: string) =>
      request<Day>("DELETE", `${d(tripId, dayId)}/stops/${encodeURIComponent(stopId)}`),
    reorder: (tripId: string, dayId: string, stopIds: string[], expectedVersion: number) =>
      request<Day>("PUT", `${d(tripId, dayId)}/order`, { stopIds, expectedVersion }),
    computeRoute: (tripId: string, dayId: string) => request<Day>("POST", `${d(tripId, dayId)}/route`),
    optimize: (tripId: string, dayId: string, expectedVersion: number) =>
      request<{ day: Day; previousStopIds: string[] }>("POST", `${d(tripId, dayId)}/optimize`, { expectedVersion }),
    exportRoute: (tripId: string, dayId: string, mode: "WALK" | "BICYCLE") =>
      request<Route>("POST", `${d(tripId, dayId)}/export-route`, { mode }),
  },
  shareLinks: {
    list: (tripId: string) => request<ShareLinkView[]>("GET", `${t(tripId)}/share-links`),
    create: (tripId: string, expiresInDays = 30) =>
      request<CreatedShareLink>("POST", `${t(tripId)}/share-links`, { expiresInDays }),
    revoke: (tripId: string, linkId: string) =>
      request<void>("DELETE", `${t(tripId)}/share-links/${encodeURIComponent(linkId)}`),
  },
  chat: {
    history: (tripId: string) => request<ChatMessageView[]>("GET", `${t(tripId)}/chat`),
    /** Streams NDJSON events; resolves when the stream ends. */
    stream: async (tripId: string, message: string, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) => {
      const res = await fetch(`${t(tripId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal,
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new ApiError(res.status, data?.error?.code ?? "UNKNOWN", data?.error?.message ?? "O assistente não respondeu.")
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ""
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ChatEvent)
      }
      if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatEvent)
    },
    clear: (tripId: string) => request<void>("DELETE", `${t(tripId)}/chat`),
    decide: (tripId: string, proposalId: string, decision: "apply" | "discard") =>
      request<ProposalView>("POST", `${t(tripId)}/chat/proposals/${encodeURIComponent(proposalId)}`, { decision }),
  },
  import: {
    extract: (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return request<ImportPreview>("POST", "/api/import", form)
    },
    commit: (tripId: string, input: CommitImportInput) =>
      request<{ placeIds: string[]; dayIds: string[] }>("POST", `${t(tripId)}/import/commit`, input),
  },
}

export const queryKeys = {
  trips: ["trips"] as const,
  trip: (tripId: string) => ["trip", tripId] as const,
  chat: (tripId: string) => ["chat", tripId] as const,
  shareLinks: (tripId: string) => ["share-links", tripId] as const,
}

/** User-facing message for any thrown error. */
export const errorMessage = (err: unknown, fallback = "Algo deu errado. Tente novamente.") =>
  err instanceof ApiError ? err.message : fallback
