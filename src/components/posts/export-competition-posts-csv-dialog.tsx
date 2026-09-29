"use client"

import * as React from "react"
import { FileCsv, Spinner } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

type Props = {
  campaignId?: string
  campaignName?: string
  triggerClassName?: string
  triggerLabel?: string
}

const csvCell = (value: string | number) => {
  let normalized = String(value)
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`
  return `"${normalized.replaceAll('"', '""')}"`
}

const dateForFileName = () => new Date().toISOString().slice(0, 10)

export function ExportCompetitionPostsCsvDialog({
  campaignId,
  campaignName,
  triggerClassName,
  triggerLabel = "Exportar CSV",
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [includeAllPosts, setIncludeAllPosts] = React.useState(true)
  const [postedAtFrom, setPostedAtFrom] = React.useState("")
  const [postedAtTo, setPostedAtTo] = React.useState("")

  const exportCsv = api.customers.exportCompetitionPostsCsv.useMutation({
    onError: (error) =>
      toast.error(error.message || "Não foi possível gerar o CSV"),
  })

  const handleExport = async () => {
    if (
      !includeAllPosts &&
      postedAtFrom &&
      postedAtTo &&
      postedAtFrom > postedAtTo
    ) {
      toast.error("A data inicial deve ser anterior à data final")
      return
    }

    try {
      const result = await exportCsv.mutateAsync({
        campaignId,
        includeAllPosts,
        postedAtFrom:
          !includeAllPosts && postedAtFrom
            ? new Date(`${postedAtFrom}T00:00:00`).toISOString()
            : undefined,
        postedAtTo:
          !includeAllPosts && postedAtTo
            ? new Date(`${postedAtTo}T23:59:59.999`).toISOString()
            : undefined,
      })

      const header = [
        "URL do vídeo",
        "Data da publicação",
        "Views",
        "Likes",
        "Comentários",
      ]
      const rows = result.posts.map((post) => [
        post.videoUrl,
        post.postedAt
          ? new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "medium",
            }).format(new Date(post.postedAt))
          : "",
        post.views,
        post.likes,
        post.comments,
      ])
      const csv = [header, ...rows]
        .map((row) => row.map(csvCell).join(";"))
        .join("\r\n")
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${result.campaignSlug}-clipposts-${dateForFileName()}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      toast.success(
        `${result.posts.length} clippost${result.posts.length === 1 ? "" : "s"} exportado${result.posts.length === 1 ? "" : "s"}`,
      )
      setOpen(false)
    } catch {
      // O callback onError da mutation já apresenta a mensagem ao usuário.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className={cn(
            "h-9 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white hover:opacity-90",
            triggerClassName,
          )}
          disabled={!campaignId && campaignName !== undefined}
        >
          <FileCsv className="size-4" weight="fill" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar clipposts em CSV</DialogTitle>
          <DialogDescription>
            {campaignName ? `${campaignName}. ` : ""}Somente posts elegíveis,
            ordenados por views.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <Checkbox
              id="include-all-posts"
              checked={includeAllPosts}
              onCheckedChange={(checked) =>
                setIncludeAllPosts(checked === true)
              }
            />
            <Label htmlFor="include-all-posts" className="cursor-pointer">
              Retornar todos os posts
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="posted-at-from">Publicado a partir de</Label>
              <Input
                id="posted-at-from"
                type="date"
                value={postedAtFrom}
                onChange={(event) => setPostedAtFrom(event.target.value)}
                disabled={includeAllPosts}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="posted-at-to">Publicado até</Label>
              <Input
                id="posted-at-to"
                type="date"
                value={postedAtTo}
                onChange={(event) => setPostedAtTo(event.target.value)}
                disabled={includeAllPosts}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={exportCsv.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exportCsv.isPending}>
            {exportCsv.isPending ? (
              <Spinner className="size-4 animate-spin" />
            ) : (
              <FileCsv className="size-4" />
            )}
            {exportCsv.isPending ? "Gerando..." : "Baixar CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
