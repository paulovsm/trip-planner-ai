import type { FunctionDeclaration } from "@google/genai"
import { z } from "zod"
import { IsoDate, TimeOfDay } from "@/lib/domain/schemas"
import { toGeminiSchema } from "./schema"

// Assistant tools (ADR-0005). Read tools run automatically; every write tool only
// creates a Proposal the user must apply. Existing Places are referenced by short
// refs (P1, P2, … in the order of <trip_data>); new places only by a googlePlaceId
// returned by searchPlaces in the same conversation turn — so the model can never
// invent coordinates or database ids.

const PlaceRef = z.string().regex(/^P\d{1,3}$/, "Use a referência do lugar, ex.: P3")
const GooglePlaceId = z.string().min(3).max(256)

export const TOOL_ARGS = {
  searchPlaces: z.object({
    query: z.string().trim().min(2).max(200).describe("O que buscar, com a cidade. Ex.: 'pastelaria em Belém, Lisboa'"),
  }),
  proposeAddPlace: z.object({
    googlePlaceId: GooglePlaceId.describe("googlePlaceId de um resultado de searchPlaces"),
  }),
  proposeAddStop: z
    .object({
      date: IsoDate.describe("Data do dia (AAAA-MM-DD); o dia é criado se não existir"),
      placeRef: PlaceRef.optional().describe("Lugar já salvo (ex.: P3)"),
      googlePlaceId: GooglePlaceId.optional().describe("Ou um lugar novo vindo de searchPlaces"),
      time: TimeOfDay.optional().describe("Horário planejado HH:mm"),
    })
    .refine((v) => !!v.placeRef !== !!v.googlePlaceId, "Informe placeRef OU googlePlaceId"),
  proposeRemoveStop: z.object({ date: IsoDate, placeRef: PlaceRef }),
  proposeMarkVisited: z.object({ placeRef: PlaceRef, visited: z.boolean() }),
  proposePlanDays: z.object({
    days: z
      .array(z.object({ date: IsoDate, placeRefs: z.array(PlaceRef).min(1).max(30) }))
      .min(1)
      .max(30)
      .describe("Distribui lugares já salvos entre dias (adiciona ao fim de cada dia, criando dias que faltarem)"),
  }),
  proposeOptimizeDay: z.object({ date: IsoDate.describe("Dia cuja ordem será otimizada para o menor percurso") }),
} as const

export type ToolName = keyof typeof TOOL_ARGS
export const READ_TOOLS = new Set<ToolName>(["searchPlaces"])

const DESCRIPTIONS: Record<ToolName, string> = {
  searchPlaces: "Busca lugares reais no Google Maps. Use antes de propor um lugar novo.",
  proposeAddPlace: "Propõe salvar um lugar novo na viagem (sem dia). O usuário confirma.",
  proposeAddStop: "Propõe adicionar um lugar (salvo ou novo) a um dia do roteiro. O usuário confirma.",
  proposeRemoveStop: "Propõe remover um lugar de um dia. O usuário confirma.",
  proposeMarkVisited: "Propõe marcar/desmarcar um lugar como visitado. O usuário confirma.",
  proposePlanDays: "Propõe distribuir lugares salvos entre dias (montar o roteiro). O usuário confirma.",
  proposeOptimizeDay: "Propõe reordenar as paradas de um dia para o menor percurso. O usuário confirma.",
}

export const functionDeclarations: FunctionDeclaration[] = (Object.keys(TOOL_ARGS) as ToolName[]).map((name) => ({
  name,
  description: DESCRIPTIONS[name],
  parametersJsonSchema: toGeminiSchema(TOOL_ARGS[name]),
}))

export const isToolName = (name: string | undefined): name is ToolName => !!name && name in TOOL_ARGS
