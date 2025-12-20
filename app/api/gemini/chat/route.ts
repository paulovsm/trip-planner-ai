import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { firestore } from "@/lib/firebase";
import { z } from "zod";
import { GEMINI_MODEL_NAME, getGeminiModel } from "@/lib/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = GEMINI_MODEL_NAME;

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  tripId: z.string(),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(z.object({ text: z.string() })),
  })).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, tripId, conversationHistory } = requestSchema.parse(body);

    // 1. Fetch Trip Context
    const tripRef = firestore.collection('trips').doc(tripId);
    const tripDoc = await tripRef.get();
    const tripData = tripDoc.data();

    if (!tripDoc.exists || !tripData) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Fetch points
    const pointsSnapshot = await tripRef.collection('points').get();
    const points = pointsSnapshot.docs.map(doc => doc.data());

    // Fetch itineraries
    const itinerariesSnapshot = await tripRef.collection('itineraries').orderBy('date', 'asc').get();
    const itineraries = await Promise.all(itinerariesSnapshot.docs.map(async doc => {
      const data = doc.data();
      let items = data.items || [];
      
      // Populate point details
      items = await Promise.all(items.map(async (item: any) => {
        if (item.pointId) {
            const point = points.find(p => p.id === item.pointId);
            return { ...item, point };
        }
        return item;
      }));

      return {
        ...data,
        date: data.date.toDate(),
        items
      };
    }));

    const trip = {
        ...(tripData as any),
        points,
        itineraries
    };

    const formatDate = (date: any) => {
      if (!date) return "Não definidas";
      try {
        if (date.toDate) return date.toDate().toLocaleDateString('pt-BR');
        if (date instanceof Date) return date.toLocaleDateString('pt-BR');
        return new Date(date).toLocaleDateString('pt-BR');
      } catch (e) {
        return "Data inválida";
      }
    };

    // 2. Prepare System Prompt with Context
    const systemPrompt = `
Você é um assistente de viagens especializado e amigável.
O usuário está planejando uma viagem para ${trip.name}.

CONTEXTO DA VIAGEM:
- Nome: ${trip.name}
- Datas: ${formatDate(trip.startDate)} até ${formatDate(trip.endDate)}

PONTOS DE INTERESSE SALVOS (${trip.points.length}):
${trip.points.map((p: any) => `- ${p.name} (${p.category || "Sem categoria"}): ${p.description || ""}`).join("\n")}

ITINERÁRIOS DEFINIDOS:
${trip.itineraries.map((it: any) => `
- Dia ${it.date.toLocaleDateString()}:
  ${it.items.map((item: any) => `  ${item.order}. ${item.point?.name || "Ponto desconhecido"}`).join("\n")}
`).join("\n")}

SUA MISSÃO:
Ajude o usuário com recomendações, dicas, organização do roteiro e informações sobre o destino.
Seja conciso, prático e use formatação Markdown (negrito, listas) para facilitar a leitura.
Se o usuário pedir para adicionar um local, sugira que ele use a busca do mapa (por enquanto).

Responda sempre em Português do Brasil.
`;

    // 3. Call Gemini API
    const model = getGeminiModel(GEMINI_MODEL);

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "Entendido. Estou pronto para ajudar com o planejamento da viagem. Qual é a próxima dúvida ou solicitação?" }],
        },
        ...(conversationHistory || [])
      ],
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Error in Gemini chat:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
