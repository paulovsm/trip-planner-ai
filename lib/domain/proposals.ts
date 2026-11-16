import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { PlaceCategory } from "./categories"

// Proposals (ADR-0005): what the assistant suggests, resolved to concrete ids and
// trusted data. Pure: resolution and summaries are unit-tested.

export type ProposalPlace = {
  googlePlaceId: string
  name: string
  address?: string
  city?: string
  category: PlaceCategory
  location: { lat: number; lng: number }
}

export type ProposalAction =
  | { kind: "addPlace"; place: ProposalPlace }
  | { kind: "addStop"; date: string; placeId?: string; place?: ProposalPlace; time?: string }
  | { kind: "removeStop"; date: string; placeId: string }
  | { kind: "markVisited"; placeId: string; visited: boolean }
  | { kind: "planDays"; days: { date: string; placeIds: string[] }[] }
  | { kind: "optimizeDay"; date: string }

export type ProposalStatus = "pending" | "applying" | "applied" | "discarded" | "failed"

export type ProposalView = {
  id: string
  kind: ProposalAction["kind"]
  summary: string
  status: ProposalStatus
  error?: string
}

export type ResolveContext = {
  /** P-ref → Place id */
  refs: Map<string, string>
  placeNames: Map<string, string>
  /** googlePlaceId → trusted search result from this turn */
  searchResults: Map<string, ProposalPlace>
  /** googlePlaceId → existing Place id (avoid duplicates) */
  existingByGoogleId: Map<string, string>
}

export class ProposalArgError extends Error {}

const ref = (ctx: ResolveContext, r: string) => {
  const id = ctx.refs.get(r)
  if (!id) throw new ProposalArgError(`Referência ${r} não existe. Use as referências da lista de lugares.`)
  return id
}
const searched = (ctx: ResolveContext, gid: string) => {
  const p = ctx.searchResults.get(gid)
  if (!p) throw new ProposalArgError("Esse googlePlaceId não veio de searchPlaces. Busque o lugar antes de propor.")
  return p
}

type Args = Record<string, unknown>

/** Turns validated tool args into a concrete action, or throws ProposalArgError (sent back to the model). */
export function resolveAction(tool: string, args: Args, ctx: ResolveContext): ProposalAction {
  switch (tool) {
    case "proposeAddPlace": {
      const place = searched(ctx, args.googlePlaceId as string)
      const existing = ctx.existingByGoogleId.get(place.googlePlaceId)
      if (existing) throw new ProposalArgError(`${place.name} já está salvo na viagem.`)
      return { kind: "addPlace", place }
    }
    case "proposeAddStop": {
      const date = args.date as string
      const time = args.time as string | undefined
      if (args.placeRef) return { kind: "addStop", date, placeId: ref(ctx, args.placeRef as string), time }
      const place = searched(ctx, args.googlePlaceId as string)
      const existing = ctx.existingByGoogleId.get(place.googlePlaceId)
      return existing ? { kind: "addStop", date, placeId: existing, time } : { kind: "addStop", date, place, time }
    }
    case "proposeRemoveStop":
      return { kind: "removeStop", date: args.date as string, placeId: ref(ctx, args.placeRef as string) }
    case "proposeMarkVisited":
      return { kind: "markVisited", placeId: ref(ctx, args.placeRef as string), visited: args.visited as boolean }
    case "proposePlanDays":
      return {
        kind: "planDays",
        days: (args.days as { date: string; placeRefs: string[] }[]).map((d) => ({
          date: d.date,
          placeIds: [...new Set(d.placeRefs.map((r) => ref(ctx, r)))],
        })),
      }
    case "proposeOptimizeDay":
      return { kind: "optimizeDay", date: args.date as string }
    default:
      throw new ProposalArgError(`Ferramenta desconhecida: ${tool}`)
  }
}

const dayLabel = (date: string) => format(parseISO(date), "EEE, d/M", { locale: ptBR })

/** Human-readable card text (pt-BR). */
export function summarize(action: ProposalAction, placeNames: Map<string, string>): string {
  const name = (id: string) => placeNames.get(id) ?? "lugar"
  switch (action.kind) {
    case "addPlace":
      return `Salvar ${action.place.name}${action.place.city ? ` (${action.place.city})` : ""} na viagem`
    case "addStop":
      return `Adicionar ${action.place ? action.place.name : name(action.placeId!)} em ${dayLabel(action.date)}${
        action.time ? ` às ${action.time}` : ""
      }`
    case "removeStop":
      return `Remover ${name(action.placeId)} de ${dayLabel(action.date)}`
    case "markVisited":
      return `${action.visited ? "Marcar" : "Desmarcar"} ${name(action.placeId)} como visitado`
    case "planDays":
      return action.days
        .map((d) => `${dayLabel(d.date)}: ${d.placeIds.map(name).join(", ")}`)
        .join(" · ")
    case "optimizeDay":
      return `Otimizar a ordem de ${dayLabel(action.date)} para o menor percurso`
  }
}
