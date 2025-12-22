import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { geocodeAddress } from "@/lib/maps";
import mammoth from "mammoth";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (file.type === "application/pdf") {
      const pdf = require("pdf-parse");
      const data = await pdf(buffer);
      text = data.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // Use Gemini to extract structured data
    const model = getGeminiModel();
    const prompt = `
      Analise minuncionsamente o seguinte texto de um roteiro de viagem e extraia duas informações principais:
      1. Pontos de interesse (POIs)
      2. Roteiro sugerido (Itineraries)

      Para cada POI, identifique:
      - name (Nome do local)
      - description (Breve descrição)
      - category (Categoria. Escolha OBRIGATORIAMENTE uma das seguintes: Hospedagem, Gastronomia, Cultura, História, Natureza, Compras, Turismo, Entretenimento, Transporte)
      - address (Endereço ou localização aproximada)
      - city (Cidade onde o ponto está localizado)

      Para cada item do Roteiro (Itinerary), identifique:
      - date (Data sugerida no formato YYYY-MM-DD, se disponível, ou null)
      - day (Dia do roteiro, ex: 1, 2, 3...)
      - items (Lista de nomes dos POIs visitados neste dia, deve corresponder exatamente ao campo 'name' dos POIs extraídos)

      Retorne APENAS um JSON com a seguinte estrutura:
      {
        "pois": [ ... array de POIs ... ],
        "itineraries": [ ... array de Itineraries ... ]
      }
      
      Não use markdown code blocks.
      
      Texto do roteiro:
      ${text} // Limit context window if necessary
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonString = response.text();

    // Clean up markdown code blocks if present
    jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsedData = JSON.parse(jsonString);
    const pois = parsedData.pois || [];
    const itineraries = parsedData.itineraries || [];

    // Normalize keys to ensure frontend compatibility
    const normalizedPois = Array.isArray(pois) ? pois.map((poi: any) => ({
      name: poi.name || poi.Nome || poi.nome || "",
      description: poi.description || poi.Descrição || poi.descricao || poi.descrição || "",
      category: poi.category || poi.Categoria || poi.categoria || "",
      address: poi.address || poi.Endereço || poi.endereco || poi.endereço || "",
      city: poi.city || poi.Cidade || poi.cidade || "",
    })) : [];

    // Return POIs without geocoding (will be done on client-side)
    const poisWithPlaceholders = normalizedPois.map((poi: any) => ({
      ...poi,
      latitude: 0,
      longitude: 0,
    }));

    return NextResponse.json({ 
      pois: poisWithPlaceholders,
      itineraries: itineraries
    });
  } catch (error) {
    console.error("Error processing file:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}
