import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });

export const geminiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });

export const getGeminiModel = (modelName: string = GEMINI_MODEL_NAME) => {
  return genAI.getGenerativeModel({ model: modelName });
};
