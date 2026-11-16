import AxeBuilder from "@axe-core/playwright"
import { expect, seedTrip, test } from "./helpers"

const names = (page: import("@playwright/test").Page) =>
  page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Arrastar / }) }).locator("span.font-medium")

test.describe("trip screen", () => {
  test("lists trips and opens one", async ({ page, request }, info) => {
    const { tripId } = await seedTrip(page.request ?? request)
    await page.goto("/trips")
    await expect(page.getByRole("heading", { name: "Minhas viagens" })).toBeVisible()
    await page.getByRole("link", { name: /Lisboa E2E/ }).first().click()
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}`))
    await expect(page.getByRole("heading", { name: "Lisboa E2E" })).toBeVisible()
    await page.screenshot({ path: `test-results/screens/${info.project.name}-trip-roteiro.png` })
  })

  test("reorders stops with the keyboard and persists the order", async ({ page }) => {
    const { tripId, dayId } = await seedTrip(page.request)
    await page.goto(`/trips/${tripId}?day=${dayId}`)
    await expect(names(page)).toHaveText(["Torre de Belém", "Mosteiro dos Jerónimos", "LX Factory"])

    const handle = page.getByRole("button", { name: "Arrastar Torre de Belém" })
    await handle.focus()
    // Paced like a person: dnd-kit measures the list after lifting.
    for (const key of ["Space", "ArrowDown", "ArrowDown", "Space"]) {
      await page.keyboard.press(key)
      await page.waitForTimeout(250)
    }
    await expect(names(page)).toHaveText(["Mosteiro dos Jerónimos", "LX Factory", "Torre de Belém"])

    await expect
      .poll(async () => {
        const detail = await (await page.request.get(`/api/trips/${tripId}`)).json()
        const byId = new Map(detail.places.map((p: { id: string; name: string }) => [p.id, p.name]))
        return detail.days[0].stops.map((s: { placeId: string }) => byId.get(s.placeId))
      })
      .toEqual(["Mosteiro dos Jerónimos", "LX Factory", "Torre de Belém"])
  })

  test("marks a place visited while offline and syncs when back online", async ({ page, context }) => {
    const { tripId, dayId, placeIds } = await seedTrip(page.request)
    await page.goto(`/trips/${tripId}?day=${dayId}`)
    await expect(page.getByRole("button", { name: "Marcar Torre de Belém como visitado" })).toBeVisible()

    await context.setOffline(true)
    await page.getByRole("button", { name: "Marcar Torre de Belém como visitado" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible()
    await expect(page.getByRole("status").filter({ hasText: "1 pendente" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Desmarcar Torre de Belém como visitado" })).toBeVisible()

    await context.setOffline(false)
    await expect
      .poll(async () => {
        const detail = await (await page.request.get(`/api/trips/${tripId}`)).json()
        return detail.places.find((p: { id: string }) => p.id === placeIds[0]).visited
      })
      .toBe(true)
    await expect(page.getByRole("status").filter({ hasText: "pendente" })).toHaveCount(0)
  })

  test("switches sections and shows members and share links", async ({ page }, info) => {
    const { tripId } = await seedTrip(page.request)
    await page.goto(`/trips/${tripId}?tab=places`)
    await expect(page.getByText("3 lugares · 0 visitados")).toBeVisible()
    await page.screenshot({ path: `test-results/screens/${info.project.name}-trip-places.png` })
    await page.goto(`/trips/${tripId}?tab=mais`)
    await expect(page.getByRole("heading", { name: "Pessoas" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Link público" })).toBeVisible()
    await page.screenshot({ path: `test-results/screens/${info.project.name}-trip-more.png`, fullPage: true })
  })

  test("public share link is read-only and has no notes", async ({ page, browser }) => {
    const { tripId, dayId, stopIds } = await seedTrip(page.request)
    await page.request.patch(`/api/trips/${tripId}/days/${dayId}/stops/${stopIds[0]}`, { data: { notes: "SEGREDO-42", time: "10:00" } })
    const link = await (await page.request.post(`/api/trips/${tripId}/share-links`, { data: { expiresInDays: 7 } })).json()

    const anon = await browser.newContext()
    const pub = await anon.newPage()
    await pub.goto(link.path)
    await expect(pub.getByRole("heading", { name: "Lisboa E2E" })).toBeVisible()
    await expect(pub.getByText("Torre de Belém").first()).toBeVisible()
    await expect(pub.getByText("SEGREDO-42")).toHaveCount(0)
    await anon.close()
  })

  test("has no serious accessibility violations", async ({ page }) => {
    const { tripId, dayId } = await seedTrip(page.request)
    for (const url of ["/trips", `/trips/${tripId}?day=${dayId}`, `/trips/${tripId}?tab=places`]) {
      await page.goto(url)
      await page.waitForLoadState("networkidle")
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
      expect(serious.map((v) => `${url}: ${v.id} (${v.nodes.length})`)).toEqual([])
    }
  })
})
