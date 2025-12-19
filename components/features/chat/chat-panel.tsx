"use client"

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "model";
  content: string;
}

interface ChatPanelProps {
  tripId: string;
}

export function ChatPanel({ tripId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const newMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    try {
      // Prepare history for API (excluding the last message we just added locally)
      const history = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          tripId,
          conversationHistory: history
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        { role: "model", content: data.response }
      ]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-l bg-background/50 backdrop-blur-sm">
      <div className="p-4 border-b flex items-center gap-2 font-semibold text-primary">
        <Sparkles className="w-5 h-5" />
        Assistente IA
      </div>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground p-8">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="mb-2 font-medium">Olá! Sou seu assistente de viagem.</p>
            <p className="text-sm">Posso ajudar com dicas, sugestões de roteiro e informações sobre o destino.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Digitando...
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
