"use client"

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useChatStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface ChatPanelProps {
  tripId: string;
}

export function ChatPanel({ tripId }: ChatPanelProps) {
  const { getMessages, addMessage, clearMessages } = useChatStore();
  const messages = getMessages(tripId);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    addMessage(tripId, { role: "user", content });
    setIsLoading(true);

    try {
      // Prepare history for API (including the message we just added)
      const currentMessages = getMessages(tripId);
      const history = currentMessages.map(msg => ({
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
      
      addMessage(tripId, { role: "model", content: data.response });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    clearMessages(tripId);
    toast.success("Nova conversa iniciada!");
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 border-l bg-background/50 backdrop-blur-sm">
      <div className="p-4 border-b flex items-center justify-between font-semibold text-primary flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Assistente IA
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-primary"
            onClick={handleNewChat}
            title="Iniciar nova conversa"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Nova conversa
          </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 min-h-0" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
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
      </div>

      <div className="flex-shrink-0">
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
