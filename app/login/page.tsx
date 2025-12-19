"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao TripPlanner</CardTitle>
          <CardDescription>
            Faça login para começar a planejar suas viagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => signIn("google", { callbackUrl: "/trips" })}
          >
            Continuar com Google
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => signIn("facebook", { callbackUrl: "/trips" })}
          >
            Continuar com Facebook
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => signIn("apple", { callbackUrl: "/trips" })}
          >
            Continuar com Apple
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
