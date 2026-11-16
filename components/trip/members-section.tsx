"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, UserMinus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage, queryKeys } from "@/lib/client/api"
import type { MemberView, TripDetail } from "@/lib/domain/dto"
import { useTrip } from "./trip-context"

const ROLE_LABEL: Record<MemberView["role"], string> = { owner: "Dono", editor: "Coeditor", pending: "Convite pendente" }

export function MembersSection() {
  const { tripId, detail } = useTrip()
  const qc = useQueryClient()
  const [email, setEmail] = useState("")
  const isOwner = detail.role === "owner"

  const setMembers = (members: MemberView[]) =>
    qc.setQueryData<TripDetail>(queryKeys.trip(tripId), (d) => (d ? { ...d, members } : d))

  const invite = useMutation({
    mutationFn: (e: string) => api.members.invite(tripId, e),
    onSuccess: (members) => {
      setMembers(members)
      setEmail("")
      toast.success("Convite enviado. A pessoa já pode entrar com essa conta Google.")
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível convidar.")),
  })

  const remove = useMutation({
    mutationFn: (e: string) => api.members.remove(tripId, e),
    onSuccess: setMembers,
    onError: (err) => toast.error(errorMessage(err, "Não foi possível remover.")),
  })

  return (
    <section className="space-y-3" aria-labelledby="members-title">
      <h2 id="members-title" className="font-semibold">
        Pessoas
      </h2>
      <ul className="divide-y rounded-xl border">
        {detail.members.map((m) => (
          <li key={m.email} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{m.email}</p>
              <p className="text-muted-foreground text-xs">{ROLE_LABEL[m.role]}</p>
            </div>
            {isOwner && m.role !== "owner" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${m.email}`}
                disabled={remove.isPending}
                onClick={() => confirm(`Remover ${m.email} desta viagem?`) && remove.mutate(m.email)}
              >
                <UserMinus className="size-5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) invite.mutate(email.trim())
          }}
        >
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="email@gmail.com"
            aria-label="Email para convidar"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pointer-coarse:h-11"
          />
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} Convidar
          </Button>
        </form>
      )}
      <p className="text-muted-foreground text-xs">
        Coeditores podem alterar lugares e dias. Só o dono convida, gera links e exclui a viagem.
      </p>
    </section>
  )
}
