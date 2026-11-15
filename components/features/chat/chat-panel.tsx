"use client"

import { useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, errorMessage, queryKeys, type ChatMessageView } from "@/lib/client/api"
import { ChatInput } from "./chat-input"
import { ChatMessage } from "./chat-message"

export function ChatPanel({ tripId }: { tripId: string }) {
  const qc = useQueryClient()
  const key = queryKeys.chat(tripId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // History lives on the server (per user per Trip) and survives reloads.
  const history = useQuery({ queryKey: key, queryFn: () => api.chat.history(tripId) })
  const messages = history.data ?? []

  const send = useMutation({
    mutationFn: (text: string) => api.chat.send(tripId, text),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<ChatMessageView[]>(key)
      const optimistic: ChatMessageView = { id: `local-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() }
      qc.setQueryData<ChatMessageView[]>(key, (old = []) => [...old, optimistic])
      return { previous }
    },
    onSuccess: (reply) => qc.setQueryData<ChatMessageView[]>(key, (old = []) => [...old, reply]),
    onError: (err, _text, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      toast.error(errorMessage(err, "Erro ao enviar mensagem. Tente novamente."))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const clear = useMutation({
    mutationFn: () => api.chat.clear(tripId),
    onSuccess: () => {
      qc.setQueryData(key, [])
      toast.success("Nova conversa iniciada!")
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao limpar a conversa.")),
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, send.isPending])

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
            onClick={() => clear.mutate()}
            disabled={clear.isPending || send.isPending}
            title="Iniciar nova conversa"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Nova conversa
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0" ref={scrollRef} aria-live="polite">
        {history.isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="mb-2 font-medium">Olá! Sou seu assistente de viagem.</p>
            <p className="text-sm">Posso ajudar com dicas, sugestões de roteiro e informações sobre o destino.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.text} sources={msg.sources} />
            ))}
            {send.isPending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Pensando...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <ChatInput onSend={(text) => send.mutate(text)} isLoading={send.isPending} />
      </div>
    </div>
  )
}
