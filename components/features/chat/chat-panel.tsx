"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, errorMessage, queryKeys, type ChatMessageView } from "@/lib/client/api"
import type { ProposalView } from "@/lib/domain/proposals"
import { ChatInput } from "./chat-input"
import { ChatMessage } from "./chat-message"
import { ProposalCard } from "./proposal-card"

type Streaming = { user: string; text: string; status?: string; proposals: ProposalView[] }

const SUGGESTIONS = [
  "Sugira 3 cafés perto das paradas de amanhã e adicione o melhor",
  "Monte os dias com os lugares que ainda não estão no roteiro",
  "O que ver em um dia de chuva?",
]

export function ChatPanel({ tripId }: { tripId: string }) {
  const qc = useQueryClient()
  const key = queryKeys.chat(tripId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abort = useRef<AbortController | null>(null)
  const [streaming, setStreaming] = useState<Streaming | null>(null)
  const [deciding, setDeciding] = useState<Set<string>>(new Set())

  const history = useQuery({ queryKey: key, queryFn: () => api.chat.history(tripId) })
  const messages = history.data ?? []

  const send = async (text: string) => {
    const controller = new AbortController()
    abort.current = controller
    setStreaming({ user: text, text: "", proposals: [] })
    try {
      await api.chat.stream(
        tripId,
        text,
        (e) => {
          if (e.type === "text") setStreaming((s) => s && { ...s, text: s.text + e.delta, status: undefined })
          else if (e.type === "status") setStreaming((s) => s && { ...s, status: e.text })
          else if (e.type === "proposal") setStreaming((s) => s && { ...s, proposals: [...s.proposals, e.proposal] })
          else if (e.type === "error") toast.error(e.message)
          else if (e.type === "done") {
            const userMsg: ChatMessageView = { id: `u-${e.message.id}`, role: "user", text, createdAt: e.message.createdAt }
            qc.setQueryData<ChatMessageView[]>(key, (old = []) => [...old, userMsg, e.message])
          }
        },
        controller.signal,
      )
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error(errorMessage(err, "Erro ao falar com o assistente."))
    } finally {
      setStreaming(null)
      abort.current = null
      qc.invalidateQueries({ queryKey: key })
    }
  }

  const updateProposal = (p: ProposalView) =>
    qc.setQueryData<ChatMessageView[]>(key, (old = []) =>
      old.map((m) => (m.proposals?.some((x) => x.id === p.id) ? { ...m, proposals: m.proposals.map((x) => (x.id === p.id ? p : x)) } : m)),
    )

  const decide = async (proposal: ProposalView, decision: "apply" | "discard") => {
    setDeciding((s) => new Set(s).add(proposal.id))
    try {
      const updated = await api.chat.decide(tripId, proposal.id, decision)
      updateProposal(updated)
      if (updated.status === "applied") {
        toast.success("Alteração aplicada.")
        qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) })
      } else if (updated.status === "failed") toast.error(updated.error ?? "Não foi possível aplicar.")
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao decidir a proposta."))
      qc.invalidateQueries({ queryKey: key })
    } finally {
      setDeciding((s) => {
        const n = new Set(s)
        n.delete(proposal.id)
        return n
      })
    }
  }

  const applyAll = async (proposals: ProposalView[]) => {
    for (const p of proposals.filter((x) => x.status === "pending")) await decide(p, "apply")
  }

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
  }, [messages.length, streaming?.text, streaming?.proposals.length])

  const renderProposals = (proposals?: ProposalView[]) =>
    proposals && proposals.length > 0 ? (
      <div className="ml-11 space-y-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} busy={deciding.has(p.id)} onDecide={(d) => decide(p, d)} />
        ))}
        {proposals.filter((p) => p.status === "pending").length > 1 && (
          <Button size="sm" variant="secondary" onClick={() => applyAll(proposals)}>
            Aplicar todas
          </Button>
        )}
      </div>
    ) : null

  return (
    <div className="bg-background/50 flex h-full min-h-0 flex-1 flex-col">
      <div className="text-primary flex shrink-0 items-center justify-between border-b px-4 py-2 font-semibold">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" />
          Assistente IA
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => clear.mutate()} disabled={clear.isPending || !!streaming}>
            <RotateCcw /> Nova conversa
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" ref={scrollRef} aria-live="polite">
        {history.isLoading ? (
          <div className="text-muted-foreground flex justify-center p-8">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 && !streaming ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 p-6 text-center">
            <Sparkles className="size-10 opacity-30" />
            <p className="text-foreground font-medium">Olá! Sou seu assistente de viagem.</p>
            <p className="text-sm">Dou dicas e posso propor mudanças no roteiro — você confirma cada uma.</p>
            <div className="mt-2 flex w-full flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" className="h-auto min-h-11 whitespace-normal text-left" onClick={() => send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                <ChatMessage role={m.role} content={m.text} sources={m.sources} />
                {renderProposals(m.proposals)}
              </div>
            ))}
            {streaming && (
              <div className="space-y-2">
                <ChatMessage role="user" content={streaming.user} />
                {streaming.text ? (
                  <ChatMessage role="model" content={streaming.text} />
                ) : (
                  <div className="text-muted-foreground flex items-center gap-2 p-2 text-sm" role="status">
                    <Loader2 className="size-4 animate-spin" /> {streaming.status ?? "Pensando…"}
                  </div>
                )}
                {renderProposals(streaming.proposals)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0">
        <ChatInput onSend={send} onStop={() => abort.current?.abort()} isLoading={!!streaming} />
      </div>
    </div>
  )
}
