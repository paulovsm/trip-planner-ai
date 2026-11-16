"use client"

import Link from "next/link"
import { signIn, useSession } from "next-auth/react"
import { LogOut, MapPin, Map as MapIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSignOut } from "@/hooks/use-sign-out"

/** Top bar for list/landing pages (the trip screen has its own header). */
export function Navbar() {
  const { data: session } = useSession()
  const signOut = useSignOut()

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur pt-safe">
      <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
        <Link href={session ? "/trips" : "/"} className="text-primary flex items-center gap-2 text-lg font-bold">
          <MapPin className="size-5" aria-hidden />
          TripPlanner
        </Link>
        {session ? (
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/trips">Minhas viagens</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Conta">
                  <Avatar className="size-8">
                    <AvatarImage src={session.user?.image || ""} alt="" />
                    <AvatarFallback>{session.user?.name?.[0] ?? "?"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="truncate font-normal">{session.user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/trips">
                    <MapIcon /> Minhas viagens
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button onClick={() => signIn(undefined, { callbackUrl: "/trips" })}>Entrar</Button>
        )}
      </div>
    </header>
  )
}
