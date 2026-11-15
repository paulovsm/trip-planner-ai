import { beforeAll, describe, expect, it } from "vitest"
import { clearChat, getChatHistory, sendChatMessage } from "@/lib/server/commands/chat"
import { createDay } from "@/lib/server/commands/days"
import { commitImport } from "@/lib/server/commands/import"
import { createTrip, getTripDetail } from "@/lib/server/commands/trips"
import { alice, belem, bob, expectCode, jeronimos, lxFactory } from "./helpers"

beforeAll(() => {
  process.env.AI_FAKE = "1"
})

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
    const reply = await sendChatMessage(alice, trip.id, "Onde comer pastel de nata?")
    expect(reply.role).toBe("model")

    const history = await getChatHistory(alice, trip.id)
    expect(history.map((m) => [m.role, m.text.slice(0, 9)])).toEqual([
      ["user", "Onde come"],
      ["model", "Resposta "],
    ])

    await sendChatMessage(alice, trip.id, "E à noite?")
    expect((await getChatHistory(alice, trip.id)).filter((m) => m.role === "user")).toHaveLength(2)

    await clearChat(alice, trip.id)
    expect(await getChatHistory(alice, trip.id)).toEqual([])
  })

  it("is not available to non-members", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    await expectCode(sendChatMessage(bob, trip.id, "oi"), "NOT_FOUND")
    await expectCode(getChatHistory(bob, trip.id), "NOT_FOUND")
  })
})
