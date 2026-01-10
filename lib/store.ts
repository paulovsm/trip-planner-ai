import { create } from 'zustand'

interface AppState {
  // Define your state here
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}))

// Chat store for persisting chat messages across component mounts
export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ChatState {
  // Messages keyed by tripId
  messagesByTrip: Record<string, ChatMessage[]>;
  getMessages: (tripId: string) => ChatMessage[];
  addMessage: (tripId: string, message: ChatMessage) => void;
  clearMessages: (tripId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByTrip: {},
  getMessages: (tripId: string) => get().messagesByTrip[tripId] || [],
  addMessage: (tripId: string, message: ChatMessage) => set((state) => ({
    messagesByTrip: {
      ...state.messagesByTrip,
      [tripId]: [...(state.messagesByTrip[tripId] || []), message],
    },
  })),
  clearMessages: (tripId: string) => set((state) => ({
    messagesByTrip: {
      ...state.messagesByTrip,
      [tripId]: [],
    },
  })),
}))
