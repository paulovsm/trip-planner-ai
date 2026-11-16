"use client"

import { useState } from "react"
import { SendHorizontal, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function ChatInput({ onSend, onStop, isLoading }: { onSend: (message: string) => void; onStop?: () => void; isLoading: boolean }) {
  const [input, setInput] = useState("")

  const send = () => {
    if (!input.trim() || isLoading) return
    onSend(input.trim())
    setInput("")
  }

  return (
    <form
      className="bg-background flex items-end gap-2 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends on desktop; on touch keyboards Enter inserts a new line.
          const coarse = window.matchMedia("(pointer: coarse)").matches
          if (e.key === "Enter" && !e.shiftKey && !coarse) {
            e.preventDefault()
            send()
          }
        }}
        placeholder="Peça dicas ou alterações no roteiro…"
        aria-label="Mensagem para o assistente"
        enterKeyHint="send"
        maxLength={2000}
        rows={1}
        className="max-h-[150px] min-h-11 resize-none text-base md:text-sm"
      />
      {isLoading ? (
        <Button type="button" size="icon" variant="secondary" onClick={onStop} aria-label="Parar resposta" className="size-11 shrink-0">
          <Square className="size-4" />
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Enviar" className="size-11 shrink-0">
          <SendHorizontal className="size-5" />
        </Button>
      )}
    </form>
  )
}
