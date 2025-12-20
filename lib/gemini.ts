import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

class GenerativeModelWrapper {
  constructor(private ai: GoogleGenAI, private modelName: string) { }

  async generateContent(prompt: string | any) {
    const tools = [
      {
        googleSearch: {
        }
      },
    ];

    const config = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
      tools,
    };

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      config: config,
      contents: prompt
    });

    return {
      response: {
        text: () => response.text || ""
      }
    };
  }

  startChat(config?: any) {
    const chat = this.ai.chats.create({
      model: this.modelName,
      history: config?.history
    });

    return {
      sendMessage: async (msg: string | any) => {
        const response = await chat.sendMessage({ message: msg });
        return {
          response: {
            text: () => response.text || ""
          }
        };
      }
    };
  }
}

export const model = new GenerativeModelWrapper(ai, GEMINI_MODEL_NAME);

export const geminiModel = new GenerativeModelWrapper(ai, GEMINI_MODEL_NAME);

export const getGeminiModel = (modelName: string = GEMINI_MODEL_NAME) => {
  return new GenerativeModelWrapper(ai, modelName);
};
