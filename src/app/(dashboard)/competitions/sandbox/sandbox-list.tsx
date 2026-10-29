"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowSquareOut,
  CalendarBlank,
  CopySimple,
  DownloadSimple,
  Flask,
  PencilSimple,
  Spinner,
  Trash,
  Trophy,
  UserCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import {
  ArenaHeroViz,
  ArenaHeroVizSkeleton,
} from "@/components/competitions/arena-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { Reveal } from "@/components/shared/reveal"
import { CardGridSkeleton } from "@/components/shared/skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type RouterOutputs } from "@/trpc/react"

import { CAMPAIGN_STATUS_CONFIG, EmptyState } from "../[slug]/shared"
import { clearDraft } from "./[id]/sandbox-draft"

type SandboxItem = RouterOutputs["competitionSandbox"]["list"][number]

function formatDateTime(date: Date) {
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export default function SandboxList() {
  const router = useRouter()
  const utils = api.useUtils()
  const campaigns = api.competitionSandbox.campaigns.useQuery()
  const sandboxes = api.competitionSandbox.list.useQuery()

  const [campaignId, setCampaignId] = React.useState("")
  const [name, setName] = React.useState("")
  const [deleting, setDeleting] = React.useState<SandboxItem | null>(null)

  const create = api.competitionSandbox.create.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Competição importada para o sandbox")
      void utils.competitionSandbox.list.invalidate()
      router.push(`/competitions/sandbox/${id}`)
    },
    onError: (error) =>
      toast.error(error.message || "Não foi possível importar a competição"),
  })
  const duplicate = api.competitionSandbox.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Sandbox duplicado")
      void utils.competitionSandbox.list.invalidate()
    },
    onError: (error) =>
      toast.error(error.message || "Não foi possível duplicar o sandbox"),
  })
  const remove = api.competitionSandbox.delete.useMutation({
    onSuccess: (_result, { id }) => {
      toast.success("Sandbox excluído")
      setDeleting(null)
      // Voltar para a página dele não pode reabrir a cópia do cache
      clearDraft(id)
      void utils.competitionSandbox.get.reset({ id })
      void utils.competitionSandbox.list.invalidate()
    },
    onError: (error) =>
      toast.error(error.message || "Não foi possível excluir o sandbox"),
  })

  // Depois de importar, segue travado até a navegação para o editor
  const importing = create.isPending || create.isSuccess
  const items = sandboxes.data ?? []
  const sourceCount = new Set(
    items.flatMap((item) =>
      item.sourceCampaignId ? [item.sourceCampaignId] : [],
    ),
  ).size

  const handleImport = (event: React.FormEvent) => {
    event.preventDefault()
    if (!campaignId) {
      toast.error("Selecione a competição que será importada")
      return
    }
    const trimmed = name.trim()
    create.mutate({ campaignId, name: trimmed || undefined })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HomeHero
        eyebrow="Clipfy League · Competições"
        title={
          <>
            Sandbox de <span className="text-gradient">competições</span>
          </>
        }
        subtitle="Importe os dados de uma competição e edite tudo livremente: números, rankings, posts e gráficos. Nada feito aqui altera a competição real."
        isLoading={sandboxes.isLoading}
        viz={<ArenaHeroViz />}
        vizSkeleton={<ArenaHeroVizSkeleton />}
        stats={[
          {
            icon: <Flask className="size-3.5" weight="fill" />,
            label: "Sandboxes",
            value: items.length,
            kind: "int",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições de origem",
            value: sourceCount,
            kind: "int",
          },
        ]}
      />

      {/* ===== Importar ===== */}
      <Reveal immediate delayMs={60}>
        <form
          onSubmit={handleImport}
          className="glass-card relative flex flex-col gap-4 overflow-hidden rounded-3xl p-4 sm:p-5"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] blur-3xl"
          />
          <div className="relative flex min-w-0 items-center gap-3">
            <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
              <DownloadSimple className="size-5" weight="bold" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-base font-bold tracking-tight sm:text-lg">
                Importar competição
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Copia o que a página da competição mostra agora: KPIs, gráficos,
                premiações, rankings e top posts.
              </p>
            </div>
          </div>

          <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="sandbox-campaign" className="text-xs">
                Competição
              </Label>
              {campaigns.isLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (
                <Select
                  value={campaignId}
                  disabled={importing || !!campaigns.error}
                  onValueChange={setCampaignId}
                >
                  <SelectTrigger
                    id="sandbox-campaign"
                    className="h-10 w-full min-w-0 cursor-pointer rounded-xl"
                  >
                    <Trophy className="text-muted-foreground mr-1 size-4 shrink-0" />
                    <SelectValue
                      placeholder={
                        campaigns.error
                          ? "Não foi possível carregar as competições"
                          : campaigns.data?.length
                            ? "Selecione a competição"
                            : "Nenhuma competição cadastrada"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.data?.map((campaign) => (
                      <SelectItem
                        key={campaign.id}
                        value={campaign.id}
                        className="cursor-pointer"
                      >
                        {campaign.name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ·{" "}
                          {CAMPAIGN_STATUS_CONFIG[campaign.status]?.label ??
                            campaign.status}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {campaigns.error && (
                <button
                  type="button"
                  disabled={campaigns.isFetching}
                  onClick={() => void campaigns.refetch()}
                  className="text-brand-cyan not-dark:text-primary w-fit cursor-pointer text-xs font-semibold hover:underline disabled:opacity-60"
                >
                  Tentar novamente
                </button>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="sandbox-name" className="text-xs">
                Nome do sandbox{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="sandbox-name"
                value={name}
                maxLength={200}
                disabled={importing}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Apresentação para o cliente"
                className="h-10 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={importing || !campaignId}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl font-semibold"
            >
              {importing ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <DownloadSimple className="size-4" weight="bold" />
              )}
              {importing ? "Importando..." : "Importar"}
            </Button>
          </div>
        </form>
      </Reveal>

      {/* ===== Lista ===== */}
      <Reveal immediate delayMs={120}>
        {sandboxes.isLoading ? (
          <CardGridSkeleton count={3} aspectClass="h-36" withStats={false} />
        ) : sandboxes.error ? (
          <div
            role="alert"
            className="glass-card flex flex-wrap items-center gap-3 rounded-3xl p-5 text-sm text-red-500"
          >
            Não foi possível carregar os sandboxes.
            <Button
              variant="outline"
              size="sm"
              onClick={() => void sandboxes.refetch()}
              className="cursor-pointer rounded-xl"
            >
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Flask className="size-6" weight="fill" />}
            title="Nenhum sandbox ainda"
            subtitle="Importe uma competição acima para começar a editar uma cópia dela"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="glass-card glass-card-hover flex flex-col gap-4 rounded-3xl p-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Badge
                    variant="outline"
                    className="w-fit gap-1 rounded-full border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                  >
                    <Flask className="size-3" weight="fill" />
                    Sandbox
                  </Badge>
                  <Link
                    href={`/competitions/sandbox/${item.id}`}
                    className="line-clamp-2 text-base font-bold tracking-tight hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                    <Trophy className="size-3.5 shrink-0" />
                    {item.sourceCampaign ? (
                      <Link
                        href={`/competitions/${item.sourceCampaign.slug}`}
                        className="hover:text-foreground inline-flex min-w-0 items-center gap-1 truncate"
                        title="Abrir a competição real"
                      >
                        <span className="truncate">
                          {item.sourceCampaign.name}
                        </span>
                        <ArrowSquareOut className="size-3 shrink-0" />
                      </Link>
                    ) : (
                      <span className="truncate">
                        {item.sourceCampaignName} (excluída)
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <DownloadSimple className="size-3.5 shrink-0" />
                    Importado em {formatDateTime(item.importedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarBlank className="size-3.5 shrink-0" />
                    Editado em {formatDateTime(item.updatedAt)}
                  </span>
                  {item.createdBy && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <UserCircle className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {item.createdBy.name || item.createdBy.email}
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-2">
                  <Button
                    asChild
                    size="sm"
                    className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
                  >
                    <Link href={`/competitions/sandbox/${item.id}`}>
                      <PencilSimple className="size-3.5" />
                      Abrir
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 cursor-pointer rounded-xl"
                    disabled={duplicate.isPending}
                    title="Duplicar"
                    aria-label={`Duplicar ${item.name}`}
                    onClick={() => duplicate.mutate({ id: item.id })}
                  >
                    {duplicate.isPending &&
                    duplicate.variables?.id === item.id ? (
                      <Spinner className="size-3.5 animate-spin" />
                    ) : (
                      <CopySimple className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 cursor-pointer rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-500"
                    title="Excluir"
                    aria-label={`Excluir ${item.name}`}
                    onClick={() => setDeleting(item)}
                  >
                    <Trash className="size-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Reveal>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sandbox?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}” e todas as edições feitas nele serão excluídos.
              A competição real não é afetada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={remove.isPending}
              className="cursor-pointer"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              className="cursor-pointer"
              onClick={(event) => {
                event.preventDefault()
                if (deleting) remove.mutate({ id: deleting.id })
              }}
            >
              {remove.isPending ? "Excluindo…" : "Excluir sandbox"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
