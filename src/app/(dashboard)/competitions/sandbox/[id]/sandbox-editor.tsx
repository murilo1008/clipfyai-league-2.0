"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsClockwise,
  ArrowSquareOut,
  ChartBar,
  Crosshair,
  Flask,
  FloppyDisk,
  Play,
  Spinner,
  Trophy,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { useOverrideBreadcrumbs } from "@/components/header/breadcrumb-override"
import {
  setPresentationMode,
  useProvidePresentationMode,
} from "@/components/header/presentation-mode"
import { BackLink } from "@/components/navigation/back-link"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  ChartSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  describeSandboxIssue,
  sandboxDataSchema,
  type SandboxData,
} from "@/lib/competition-sandbox"
import { api, type RouterOutputs } from "@/trpc/react"

import {
  AccountsRankingForm,
  CampaignForm,
  GrowthForm,
  MonthlyRankingForm,
  PlatformDistributionForm,
  PrizesForm,
  StatsForm,
  TopPostsForm,
} from "./sandbox-forms"
import { clearDraft, readDraft, writeDraft } from "./sandbox-draft"
import {
  SandboxAccountsRanking,
  SandboxHero,
  SandboxKpis,
  SandboxMonthlyRanking,
  SandboxOverview,
  SandboxTopPosts,
} from "./sandbox-view"

type LoadedSandbox = RouterOutputs["competitionSandbox"]["get"]

type EditorState = {
  name: string
  data: SandboxData
  /** Última versão gravada no banco (base para "alterações não salvas"). */
  savedName: string
  savedData: SandboxData
  updatedAt: Date
}

function fromServer(sandbox: LoadedSandbox): EditorState {
  return {
    name: sandbox.name,
    data: sandbox.data,
    savedName: sandbox.name,
    savedData: sandbox.data,
    updatedAt: sandbox.updatedAt,
  }
}

/**
 * Por referência: toda edição cria um `data` novo, e salvar/descartar/carregar
 * aponta `data` e `savedData` para o mesmo objeto. Barato a cada tecla.
 */
function isDirty(state: EditorState) {
  return state.name !== state.savedName || state.data !== state.savedData
}

const TABS = [
  { value: "overview", icon: ChartBar, label: "Visão Geral", short: "Geral" },
  { value: "monthly", icon: Trophy, label: "Ranking Mensal", short: "Mensal" },
  {
    value: "accounts",
    icon: Crosshair,
    label: "Ranking de Contas",
    short: "Contas",
  },
  { value: "posts", icon: Play, label: "Top Posts", short: "Posts" },
] as const

export default function SandboxEditor({ id }: { id: string }) {
  const utils = api.useUtils()
  const query = api.competitionSandbox.get.useQuery(
    { id },
    { refetchOnWindowFocus: false, staleTime: Infinity, retry: false },
  )

  const [state, setState] = React.useState<EditorState | null>(null)
  const [tab, setTab] = React.useState<string>("overview")
  // Remonta os campos depois de descartar/reimportar (limpa textos em edição)
  const [formsKey, setFormsKey] = React.useState(0)
  const [isReimportOpen, setIsReimportOpen] = React.useState(false)
  // Ícone da topbar (ao lado do "ocultar valores"): marcado = modo exibição
  // (sem nada que entregue o sandbox); desmarcado = modo edição
  const presenting = useProvidePresentationMode()

  // Na exibição, a topbar mostra a trilha de uma competição
  useOverrideBreadcrumbs(
    presenting && state
      ? [
          { href: "/competitions", label: "Competições" },
          {
            href: `/competitions/sandbox/${id}`,
            label: state.data.campaign.name || "Competição",
          },
        ]
      : null,
  )

  const initializedRef = React.useRef(false)
  React.useEffect(() => {
    const loaded = query.data
    if (!loaded) return
    if (!initializedRef.current) {
      initializedRef.current = true
      const base = fromServer(loaded)
      const draft = readDraft(id)
      if (draft && draft.baseUpdatedAt === loaded.updatedAt.getTime()) {
        setState({ ...base, name: draft.name, data: draft.data })
        // Salvar e Descartar ficam na barra do modo edição
        setPresentationMode(false)
        toast.info("Alterações não salvas recuperadas", {
          description: "Salve para mantê-las ou use Descartar.",
        })
        return
      }
      if (draft) {
        clearDraft(id)
        toast.warning("Alterações não salvas descartadas", {
          description:
            "Uma versão mais nova foi salva em outra aba ou por outro admin depois delas.",
        })
      }
      setState(base)
      return
    }
    setState((prev) => {
      if (prev && prev.updatedAt.getTime() >= loaded.updatedAt.getTime()) {
        return prev
      }
      // Nunca troca edições não salvas por uma versão recarregada
      if (prev && isDirty(prev)) return prev
      return fromServer(loaded)
    })
  }, [id, query.data])

  const dirty = state ? isDirty(state) : false

  React.useEffect(() => {
    if (!state) return
    if (!dirty) {
      clearDraft(id)
      return
    }
    const timer = window.setTimeout(
      () =>
        writeDraft(id, {
          baseUpdatedAt: state.updatedAt.getTime(),
          name: state.name,
          data: state.data,
        }),
      400,
    )
    return () => window.clearTimeout(timer)
  }, [id, dirty, state])

  // Edições não salvas: avisa ao recarregar/fechar a aba e ao clicar em
  // qualquer link interno (sidebar, voltar, origem). O App Router não tem
  // bloqueio de navegação, então o clique é interceptado na captura.
  React.useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null
      if (!anchor || anchor.target === "_blank") return
      const url = new URL(anchor.href, window.location.href)
      if (
        url.origin !== window.location.origin ||
        url.pathname === window.location.pathname
      ) {
        return
      }
      if (!window.confirm("Há alterações não salvas. Sair mesmo assim?")) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])

  const update = api.competitionSandbox.update.useMutation({
    onSuccess: ({ updatedAt }, variables) => {
      setState(
        (prev) =>
          prev && {
            ...prev,
            savedName: variables.name,
            savedData: variables.data,
            updatedAt,
          },
      )
      utils.competitionSandbox.get.setData(
        { id },
        (old) =>
          old && {
            ...old,
            name: variables.name,
            data: variables.data,
            updatedAt,
          },
      )
      void utils.competitionSandbox.list.invalidate()
      toast.success("Sandbox salvo")
    },
    onError: (error) =>
      toast.error(error.message || "Não foi possível salvar o sandbox"),
  })

  const reimport = api.competitionSandbox.reimport.useMutation({
    // O próprio reimport devolve o sandbox novo: sem refetch (que, se falhasse,
    // traria de volta a versão antiga do cache)
    onSuccess: (sandbox) => {
      utils.competitionSandbox.get.setData({ id }, sandbox)
      setState(fromServer(sandbox))
      setFormsKey((key) => key + 1)
      setIsReimportOpen(false)
      void utils.competitionSandbox.list.invalidate()
      toast.success("Dados reais importados novamente")
    },
    onError: (error) =>
      toast.error(error.message || "Não foi possível reimportar os dados"),
  })

  const handleSave = React.useCallback(() => {
    if (!state || update.isPending) return
    const name = state.name.trim()
    if (!name) {
      toast.error("Informe o nome do sandbox")
      return
    }
    const parsed = sandboxDataSchema.safeParse(state.data)
    if (!parsed.success) {
      toast.error("Corrija os dados antes de salvar", {
        description: describeSandboxIssue(parsed.error),
      })
      return
    }
    // Grava a versão normalizada pelo schema (textos aparados)
    setState((prev) => prev && { ...prev, name, data: parsed.data })
    update.mutate({
      id,
      name,
      data: parsed.data,
      expectedUpdatedAt: state.updatedAt,
    })
  }, [id, state, update])

  // Ctrl/Cmd + S salva (no modo edição: na exibição, o aviso entregaria o sandbox)
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        if (dirty && !presenting) handleSave()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dirty, presenting, handleSave])

  // Callbacks estáveis: cada seção (memo) só re-renderiza quando os seus
  // dados mudam, não a cada tecla em outra seção.
  const handlers = React.useMemo(() => {
    const patch =
      <K extends keyof SandboxData>(key: K) =>
      (value: SandboxData[K]) =>
        setState(
          (prev) => prev && { ...prev, data: { ...prev.data, [key]: value } },
        )
    return {
      campaign: patch("campaign"),
      stats: patch("stats"),
      prizes: patch("prizes"),
      platformDistribution: patch("platformDistribution"),
      monthlyRanking: patch("monthlyRanking"),
      accountsRanking: patch("accountsRanking"),
      topPosts: patch("topPosts"),
      growth: (next: Pick<SandboxData, "growth" | "growthPlatforms">) =>
        setState(
          (prev) => prev && { ...prev, data: { ...prev.data, ...next } },
        ),
    }
  }, [])

  /* ===== Loading / erro ===== */
  if (query.isLoading || (!state && query.data)) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
        <Bone className="h-9 w-56" />
        <Bone className="h-24 w-full rounded-3xl" />
        <Bone className="h-64 w-full rounded-3xl" />
        <StatTilesGridSkeleton
          count={4}
          className="grid-cols-2 gap-4 lg:grid-cols-4"
        />
        <ChartSkeleton heightClass="h-72" />
      </div>
    )
  }

  if (!state) {
    const notFound = query.error?.data?.code === "NOT_FOUND"
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
            <Flask className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-lg font-bold">
              {notFound
                ? "Sandbox não encontrado"
                : "Não foi possível abrir o sandbox"}
            </p>
            <p className="text-muted-foreground mt-1 max-w-lg px-4 text-sm">
              {notFound
                ? "Este sandbox não existe mais."
                : (query.error?.message ?? "Erro ao carregar o sandbox.")}
            </p>
          </div>
          {!notFound && (
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <ArrowsClockwise className="size-4" />
              Tentar novamente
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="cursor-pointer rounded-xl"
          >
            <BackLink href="/competitions/sandbox">
              <ArrowLeft className="size-4" />
              Voltar para Sandbox
            </BackLink>
          </Button>
        </div>
      </div>
    )
  }

  const { data } = state
  const loaded = query.data
  const isEditing = !presenting

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
      {/* ===== Voltar (na exibição, igual ao da página da competição) ===== */}
      <Reveal immediate>
        <Button
          asChild
          variant="ghost"
          className="text-muted-foreground hover:text-foreground -ml-2 w-fit cursor-pointer rounded-xl"
        >
          <BackLink
            href={presenting ? "/competitions" : "/competitions/sandbox"}
          >
            <ArrowLeft className="size-4" />
            {presenting ? "Voltar para Competições" : "Voltar para Sandbox"}
          </BackLink>
        </Button>
      </Reveal>

      {/* ===== Barra do sandbox (modo edição) ===== */}
      {isEditing && (
        <Reveal immediate>
          <section className="glass-card flex flex-col gap-4 rounded-3xl border border-dashed border-violet-500/40 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                >
                  <Flask className="size-3" weight="fill" />
                  Sandbox · não altera a competição real
                </Badge>
                {dirty && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  >
                    Alterações não salvas
                  </Badge>
                )}
              </div>
              <Input
                aria-label="Nome do sandbox"
                value={state.name}
                maxLength={200}
                onChange={(event) =>
                  setState(
                    (prev) => prev && { ...prev, name: event.target.value },
                  )
                }
                className="h-10 max-w-xl rounded-xl text-base font-bold"
              />
              {loaded && (
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Trophy className="size-3.5 shrink-0" />
                    Origem:{" "}
                    {loaded.sourceCampaign ? (
                      <Link
                        href={`/competitions/${loaded.sourceCampaign.slug}`}
                        className="hover:text-foreground inline-flex min-w-0 items-center gap-1 font-semibold"
                      >
                        <span className="truncate">
                          {loaded.sourceCampaign.name}
                        </span>
                        <ArrowSquareOut className="size-3 shrink-0" />
                      </Link>
                    ) : (
                      <span className="font-semibold">
                        {loaded.sourceCampaignName} (excluída)
                      </span>
                    )}
                  </span>
                  <span>
                    Importado em{" "}
                    {format(loaded.importedAt, "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                disabled={!loaded?.sourceCampaign || reimport.isPending}
                title={
                  loaded?.sourceCampaign
                    ? "Descarta as edições e copia de novo os dados reais"
                    : "A competição de origem foi excluída"
                }
                onClick={() => setIsReimportOpen(true)}
              >
                <ArrowsClockwise className="size-3.5" />
                Reimportar
              </Button>
              {dirty && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 cursor-pointer rounded-xl"
                  disabled={update.isPending}
                  onClick={() => {
                    setState(
                      (prev) =>
                        prev && {
                          ...prev,
                          name: prev.savedName,
                          data: prev.savedData,
                        },
                    )
                    setFormsKey((key) => key + 1)
                  }}
                >
                  <ArrowCounterClockwise className="size-3.5" />
                  Descartar
                </Button>
              )}
              <Button
                size="sm"
                className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
                disabled={!dirty || update.isPending}
                title="Salvar (Ctrl+S)"
                onClick={handleSave}
              >
                {update.isPending ? (
                  <Spinner className="size-3.5 animate-spin" />
                ) : (
                  <FloppyDisk className="size-3.5" weight="fill" />
                )}
                {update.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </section>
        </Reveal>
      )}

      {/* ===== Hero + KPIs (modo exibição) ===== */}
      {!isEditing && (
        <>
          <Reveal immediate>
            <SandboxHero campaign={data.campaign} />
          </Reveal>
          <Reveal immediate delayMs={60}>
            <SandboxKpis stats={data.stats} />
          </Reveal>
        </>
      )}

      {/* ===== Tabs ===== */}
      <Reveal immediate delayMs={120}>
        <Tabs value={tab} onValueChange={setTab} className="gap-5">
          <TabsList className="bg-muted/40 grid w-full grid-cols-4 gap-1 rounded-2xl p-1">
            {TABS.map((item) => {
              const TabIcon = item.icon
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
                >
                  <TabIcon className="size-3.5" weight="fill" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.short}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {isEditing ? (
            <div key={formsKey} className="contents">
              <TabsContent value="overview" className="flex flex-col gap-5">
                <CampaignForm
                  campaign={data.campaign}
                  onChange={handlers.campaign}
                />
                <StatsForm stats={data.stats} onChange={handlers.stats} />
                <PrizesForm prizes={data.prizes} onChange={handlers.prizes} />
                <PlatformDistributionForm
                  rows={data.platformDistribution}
                  onChange={handlers.platformDistribution}
                />
                <GrowthForm
                  growth={data.growth}
                  growthPlatforms={data.growthPlatforms}
                  platformDistribution={data.platformDistribution}
                  startDate={data.campaign.startDate}
                  endDate={data.campaign.endDate}
                  targetTotal={data.stats.totalViews}
                  onChange={handlers.growth}
                />
              </TabsContent>
              <TabsContent value="monthly">
                <MonthlyRankingForm
                  rows={data.monthlyRanking}
                  metricType={data.campaign.rankingMetricType}
                  onChange={handlers.monthlyRanking}
                />
              </TabsContent>
              <TabsContent value="accounts">
                <AccountsRankingForm
                  rows={data.accountsRanking}
                  metricType={data.campaign.rankingMetricType}
                  onChange={handlers.accountsRanking}
                />
              </TabsContent>
              <TabsContent value="posts">
                <TopPostsForm
                  rows={data.topPosts}
                  onChange={handlers.topPosts}
                />
              </TabsContent>
            </div>
          ) : (
            <>
              <TabsContent value="overview">
                <SandboxOverview data={data} />
              </TabsContent>
              <TabsContent value="monthly">
                <SandboxMonthlyRanking data={data} />
              </TabsContent>
              <TabsContent value="accounts">
                <SandboxAccountsRanking data={data} />
              </TabsContent>
              <TabsContent value="posts">
                <SandboxTopPosts
                  data={data}
                  liveThumbnails={loaded?.postThumbnails}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </Reveal>

      {/* ===== Salvar flutuante (a barra do topo some ao rolar) ===== */}
      {isEditing && dirty && (
        <Button
          className="btn-gradient-auth fixed right-6 bottom-6 z-40 h-11 cursor-pointer rounded-2xl px-5 font-semibold shadow-xl"
          disabled={update.isPending}
          onClick={handleSave}
        >
          {update.isPending ? (
            <Spinner className="size-4 animate-spin" />
          ) : (
            <FloppyDisk className="size-4" weight="fill" />
          )}
          {update.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      )}

      <AlertDialog
        open={isReimportOpen}
        onOpenChange={(open) => {
          if (!reimport.isPending) setIsReimportOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reimportar os dados reais?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as edições deste sandbox
              {dirty ? ", inclusive as não salvas," : ""} serão substituídas
              pelos dados atuais de “{loaded?.sourceCampaign?.name}”. A
              competição real não é alterada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={reimport.isPending}
              className="cursor-pointer"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={reimport.isPending}
              className="cursor-pointer"
              onClick={(event) => {
                event.preventDefault()
                reimport.mutate({ id })
              }}
            >
              {reimport.isPending ? "Importando…" : "Reimportar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
