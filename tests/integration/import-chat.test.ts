import { beforeAll, describe, expect, it } from "vitest"
import { clearChat, getChatHistory, startChatTurn, type ChatEvent } from "@/lib/server/commands/chat"
import { decideProposal } from "@/lib/server/commands/proposals"
import type { SessionUser } from "@/lib/server/authz"
import { createDay } from "@/lib/server/commands/days"
import { commitImport } from "@/lib/server/commands/import"
import { createTrip, getTripDetail } from "@/lib/server/commands/trips"
import { alice, belem, bob, expectCode, jeronimos, lxFactory } from "./helpers"

beforeAll(() => {
  process.env.AI_FAKE = "1"
  process.env.MAPS_FAKE = "1"
})

async function chat(user: SessionUser, tripId: string, message: string) {
  const events: ChatEvent[] = []
  for await (const e of await startChatTurn(user, tripId, message)) events.push(e)
  const done = events.find((e) => e.type === "done")
  if (!done || done.type !== "done") throw new Error(`no done event: ${JSON.stringify(events)}`)
  return { events, message: done.message }
}

describe("commitImport", () => {
  it("creates places and days in one go, merging into existing days by date", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const existing = await createDay(alice, trip.id, { date: "2026-12-03" })

    const result = await commitImport(alice, trip.id, {
      places: [belem, jeronimos, lxFactory],
      days: [
        { date: "2026-12-03", placeIndexes: [0, 1] },
        { date: "2026-12-04", placeIndexes: [2] },
      ],
    })

    const detail = await getTripDetail(alice, trip.id)
    expect(detail.places.map((p) => [p.name, p.source])).toEqual([
      ["Torre de Belém", "import"],
      ["Mosteiro dos Jerónimos", "import"],
      ["LX Factory", "import"],
    ])
    expect(detail.days.map((d) => [d.date, d.stops.length])).toEqual([
      ["2026-12-03", 2],
      ["2026-12-04", 1],
    ])
    expect(result.dayIds[0]).toBe(existing.id)
  })

  it("rejects out-of-range place indexes and non-members", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    await expectCode(
      commitImport(alice, trip.id, { places: [belem], days: [{ date: "2026-12-03", placeIndexes: [1] }] }),
      "VALIDATION",
    )
    await expectCode(commitImport(bob, trip.id, { places: [belem], days: [] }), "NOT_FOUND")
  })
})

describe("chat persistence", () => {
  it("stores each message exactly once, per user, and clears on demand", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const { message: reply, events } = await chat(alice, trip.id, "Onde comer pastel de nata?")
    expect(reply.role).toBe("model")
    expect(events.filter((e) => e.type === "text").length).toBeGreaterThan(1) // streamed

    const history = await getChatHistory(alice, trip.id)
    expect(history.map((m) => [m.role, m.text.slice(0, 9)])).toEqual([
      ["user", "Onde come"],
      ["model", "Resposta "],
    ])

    await chat(alice, trip.id, "E à noite?")
    expect((await getChatHistory(alice, trip.id)).filter((m) => m.role === "user")).toHaveLength(2)

    await clearChat(alice, trip.id)
    expect(await getChatHistory(alice, trip.id)).toEqual([])
  })

  it("is not available to non-members", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    await expectCode(startChatTurn(bob, trip.id, "oi"), "NOT_FOUND")
    await expectCode(getChatHistory(bob, trip.id), "NOT_FOUND")
  })
})

describe("assistant proposals", () => {
  it("proposes without writing; applying runs the real commands exactly once", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const place = await (await import("@/lib/server/commands/places")).createPlace(alice, trip.id, belem)
    const { message } = await chat(alice, trip.id, "Marque a torre como visitada")
    expect(message.proposals).toHaveLength(1)
    expect(message.proposals![0]).toMatchObject({ kind: "markVisited", status: "pending", summary: "Marcar Torre de Belém como visitado" })

    // Nothing changed yet.
    expect((await getTripDetail(alice, trip.id)).places[0].visited).toBe(false)
    // History shows the proposal; hidden tool turns are not visible.
    const history = await getChatHistory(alice, trip.id)
    expect(history.map((m) => m.role)).toEqual(["user", "model"])
    expect(history[1].proposals?.[0].status).toBe("pending")

    await expectCode(decideProposal(bob, trip.id, message.proposals![0].id, "apply"), "NOT_FOUND")
    const applied = await decideProposal(alice, trip.id, message.proposals![0].id, "apply")
    expect(applied.status).toBe("applied")
    expect((await getTripDetail(alice, trip.id)).places.find((p) => p.id === place.id)!.visited).toBe(true)
    await expectCode(decideProposal(alice, trip.id, message.proposals![0].id, "apply"), "CONFLICT")
  })

  it("chains searchPlaces → proposeAddStop with a trusted Google result, creating day and place on apply", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const { message, events } = await chat(alice, trip.id, "Adicione os Pastéis de Belém no primeiro dia")
    expect(events.some((e) => e.type === "status")).toBe(true)
    const proposal = message.proposals![0]
    expect(proposal).toMatchObject({ kind: "addStop", summary: "Adicionar Pastéis de Belém em quinta, 3/12 às 10:00" })

    await decideProposal(alice, trip.id, proposal.id, "apply")
    const detail = await getTripDetail(alice, trip.id)
    expect(detail.places).toEqual([expect.objectContaining({ name: "Pastéis de Belém", source: "ai" })])
    expect(detail.days).toEqual([expect.objectContaining({ date: "2026-12-03", stops: [expect.objectContaining({ time: "10:00" })] })])
  })

  it("discarding writes nothing", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    await (await import("@/lib/server/commands/places")).createPlace(alice, trip.id, belem)
    const { message } = await chat(alice, trip.id, "marque como visitado")
    expect((await decideProposal(alice, trip.id, message.proposals![0].id, "discard")).status).toBe("discarded")
    expect((await getTripDetail(alice, trip.id)).places[0].visited).toBe(false)
  })
})
