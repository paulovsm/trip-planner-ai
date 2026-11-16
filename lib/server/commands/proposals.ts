import "server-only"
import { conflict, DomainError, notFound } from "@/lib/domain/errors"
import type { ProposalAction, ProposalStatus, ProposalView } from "@/lib/domain/proposals"
import { Day, Place } from "@/lib/domain/schemas"
import { requireTripAccess, tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc } from "../firestore-io"
import { addStop, createDay, editStop, removeStopFromDay } from "./days"
import { createPlace, updatePlace } from "./places"
import { optimizeDay } from "./routes"

// ADR-0005: the assistant only creates Proposals; applying one runs the very same
// commands as the UI, with the same authorization.

export const proposalsOf = (tripId: string, userId: string) =>
  tripRef(tripId).collection("chats").doc(userId).collection("proposals")

type ProposalDoc = {
  action: ProposalAction
  summary: string
  status: ProposalStatus
  error?: string
  messageId: string
  createdAt: string
  updatedAt: string
}

export const toView = (id: string, d: ProposalDoc): ProposalView => ({
  id,
  kind: d.action.kind,
  summary: d.summary,
  status: d.status,
  error: d.error,
})

export async function storeProposal(
  user: SessionUser,
  tripId: string,
  messageId: string,
  action: ProposalAction,
  summary: string,
): Promise<ProposalView> {
  const ref = proposalsOf(tripId, user.id).doc()
  const now = nowIso()
  const doc: ProposalDoc = { action, summary, status: "pending", messageId, createdAt: now, updatedAt: now }
  await ref.set(doc)
  return toView(ref.id, doc)
}

export async function listProposals(user: SessionUser, tripId: string): Promise<Map<string, ProposalView>> {
  const snap = await proposalsOf(tripId, user.id).orderBy("createdAt", "desc").limit(200).get()
  return new Map(snap.docs.map((d) => [d.id, toView(d.id, d.data() as ProposalDoc)]))
}

async function findDay(tripId: string, date: string): Promise<Day | null> {
  const snap = await tripRef(tripId).collection("days").where("date", "==", date).limit(1).get()
  return snap.empty ? null : readDoc(Day, snap.docs[0])
}

async function ensureDay(user: SessionUser, tripId: string, date: string): Promise<Day> {
  return (await findDay(tripId, date)) ?? createDay(user, tripId, { date })
}

async function ensurePlace(user: SessionUser, tripId: string, place: NonNullable<Extract<ProposalAction, { kind: "addStop" }>["place"]>) {
  const existing = await tripRef(tripId).collection("places").where("googlePlaceId", "==", place.googlePlaceId).limit(1).get()
  if (!existing.empty) return readDoc(Place, existing.docs[0]).id
  const created = await createPlace(
    user,
    tripId,
    {
      name: place.name,
      category: place.category,
      address: place.address,
      city: place.city,
      location: place.location,
      googlePlaceId: place.googlePlaceId,
    },
    "ai",
  )
  return created.id
}

async function execute(user: SessionUser, tripId: string, action: ProposalAction): Promise<void> {
  switch (action.kind) {
    case "addPlace":
      await ensurePlace(user, tripId, action.place)
      return
    case "addStop": {
      const placeId = action.placeId ?? (await ensurePlace(user, tripId, action.place!))
      const day = await ensureDay(user, tripId, action.date)
      const next = await addStop(user, tripId, day.id, { placeId })
      if (action.time) {
        const stop = next.stops.at(-1)!
        await editStop(user, tripId, day.id, stop.id, { time: action.time })
      }
      return
    }
    case "removeStop": {
      const day = await findDay(tripId, action.date)
      const stop = day?.stops.find((s) => s.placeId === action.placeId)
      if (!day || !stop) throw new DomainError("VALIDATION", "Essa parada não está mais nesse dia.")
      await removeStopFromDay(user, tripId, day.id, stop.id)
      return
    }
    case "markVisited":
      await updatePlace(user, tripId, action.placeId, { visited: action.visited })
      return
    case "planDays":
      for (const d of action.days) {
        let day = await ensureDay(user, tripId, d.date)
        for (const placeId of d.placeIds) {
          if (day.stops.some((s) => s.placeId === placeId)) continue
          day = await addStop(user, tripId, day.id, { placeId })
        }
      }
      return
    case "optimizeDay": {
      const day = await findDay(tripId, action.date)
      if (!day) throw new DomainError("VALIDATION", "Esse dia não existe mais.")
      await optimizeDay(user, tripId, day.id, day.version)
      return
    }
  }
}

/** Applies or discards a pending Proposal exactly once. Failures are recorded on the Proposal. */
export async function decideProposal(
  user: SessionUser,
  tripId: string,
  proposalId: string,
  decision: "apply" | "discard",
): Promise<ProposalView> {
  const ref = proposalsOf(tripId, user.id).doc(proposalId)
  const doc = await firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const snap = await tx.get(ref)
    if (!snap.exists) throw notFound("Proposta")
    const d = snap.data() as ProposalDoc
    if (d.status !== "pending") throw conflict("Esta proposta já foi decidida.")
    const status: ProposalStatus = decision === "apply" ? "applying" : "discarded"
    tx.update(ref, { status, updatedAt: nowIso() })
    return { ...d, status }
  })
  if (decision === "discard") return toView(proposalId, doc)

  try {
    await execute(user, tripId, doc.action)
    await ref.update({ status: "applied", updatedAt: nowIso() })
    return toView(proposalId, { ...doc, status: "applied" })
  } catch (err) {
    const message = err instanceof DomainError ? err.message : "Não foi possível aplicar a proposta."
    if (!(err instanceof DomainError)) console.error("[proposals] apply failed", err)
    await ref.update({ status: "failed", error: message, updatedAt: nowIso() })
    return toView(proposalId, { ...doc, status: "failed", error: message })
  }
}
