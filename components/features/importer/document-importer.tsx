"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

const formSchema = z.object({
  file: z
    .custom<FileList>()
    .refine((val) => typeof FileList !== "undefined" && val instanceof FileList, "Arquivo inválido")
    .refine((files) => files && files.length > 0, {
      message: "Por favor, selecione um arquivo.",
    }),
})

export function DocumentImporter({ onImport }: { onImport: (data: any) => void }) {
  const [isUploading, setIsUploading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", values.file[0])

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Falha na importação")
      }

      const data = await response.json()
      onImport(data)
      toast.success("Documento processado com sucesso!")
    } catch (error) {
      toast.error("Erro ao processar documento. Tente novamente.")
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Importar Roteiro
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Selecione um arquivo (PDF ou DOCX)</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf,.docx"
                      disabled={isUploading}
                      onChange={(e) => {
                        onChange(e.target.files)
                      }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isUploading} className="w-full">
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar e Extrair
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
