"use client"

import * as React from "react"
import {
  ArrowSquareOut,
  CalendarBlank,
  CheckCircle,
  Crown,
  CurrencyDollar,
  Envelope,
  Eye,
  GearSix,
  Heart,
  MapPin,
  Phone,
  Play,
  Pulse,
  SealCheck,
  Sparkle,
  Spinner,
  Trophy,
  UsersThree,
  Wallet,
  Warning,
  XCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import type { RouterOutputs } from "@/trpc/react"

import {
  APPLICATION_STATUS_CONFIG,
  formatNumber,
  useFormatCurrency,
  type AdminApplication,
} from "./shared"

const PLATFORM_URLS: Record<string, (username: string) => string> = {
  INSTAGRAM: (u) => `https://instagram.com/${u.replace("@", "")}`,
  TIKTOK: (u) => `https://tiktok.com/@${u.replace("@", "")}`,
  YOUTUBE: (u) => `https://youtube.com/@${u.replace("@", "")}`,
  KWAI: (u) => `https://kwai.com/@${u.replace("@", "")}`,
  FACEBOOK: (u) => `https://facebook.com/${u.replace("@", "")}`,
}

const TRANSACTION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  PRIZE_CREDIT: { label: "Prêmio", icon: Trophy, color: "text-amber-500" },
  BONUS: { label: "Bônus", icon: Sparkle, color: "text-violet-500" },
  ADJUSTMENT: { label: "Ajuste", icon: GearSix, color: "text-sky-500" },
  WITHDRAWAL_REQUEST: {
    label: "Saque",
    icon: CurrencyDollar,
    color: "text-red-500",
  },
}

type AllTransaction =
  RouterOutputs["admin"]["getClipperAllTransactions"]["transactions"][number]
type CampaignTransaction =
  RouterOutputs["admin"]["getClipperTransactionsInCampaign"]["transactions"][number]

export function ApplicationDetailsDialog({
  application,
  open,
  onOpenChange,
  slug,
  campaignId,
}: {
  application: AdminApplication | null
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  campaignId: string
}) {
  const utils = api.useUtils()
  const formatCurrency = useFormatCurrency()

  const [rejectionReason, setRejectionReason] = React.useState("")

  React.useEffect(() => {
    setRejectionReason("")
  }, [application?.id, open])

  /* ===== Histórico financeiro ===== */
  const { data: allTransactionsData } =
    api.admin.getClipperAllTransactions.useQuery(
      { clipperProfileId: application?.clipperProfileId ?? "" },
      { enabled: open && !!application },
    )
  const { data: campaignTransactionsData } =
    api.admin.getClipperTransactionsInCampaign.useQuery(
      {
        clipperProfileId: application?.clipperProfileId ?? "",
        campaignId,
      },
      { enabled: open && !!application && !!campaignId },
    )

  /* ===== Mutations ===== */
  const approveApplication = api.admin.approveApplication.useMutation({
    onSuccess: async () => {
      toast.success("Aplicação aprovada com sucesso!")
      onOpenChange(false)
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionApplicationsAdmin.invalidate({ slug }),
      ])
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao aprovar aplicação"),
  })

  const rejectApplication = api.admin.rejectApplication.useMutation({
    onSuccess: async () => {
      toast.success("Aplicação rejeitada")
      setRejectionReason("")
      onOpenChange(false)
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionApplicationsAdmin.invalidate({ slug }),
      ])
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao rejeitar aplicação"),
  })

  const handleApprove = () => {
    if (!application) return
    approveApplication.mutate({ applicationId: application.id })
  }

  const handleReject = () => {
    if (!application || !rejectionReason.trim()) {
      toast.error("Por favor, informe o motivo da rejeição")
      return
    }
    rejectApplication.mutate({
      applicationId: application.id,
      rejectionReason: rejectionReason.trim(),
    })
  }

  if (!application) return null

  const status =
    APPLICATION_STATUS_CONFIG[application.status] ??
    APPLICATION_STATUS_CONFIG.PENDING!
  const daysSince = Math.floor(
    (Date.now() - new Date(application.createdAt).getTime()) /
      (1000 * 60 * 60 * 24),
  )
  const isMutating =
    approveApplication.isPending || rejectApplication.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
        {/* ===== Header ===== */}
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <div className="flex items-center gap-3.5">
            <Avatar className="size-13 shrink-0 rounded-2xl sm:size-15">
              <AvatarImage
                src={application.clipperImageUrl ?? undefined}
                alt={application.clipperName}
              />
              <AvatarFallback className="bg-gradient-custom rounded-2xl text-base font-bold text-[#04222A]">
                {application.clipperName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold tracking-tight sm:text-lg">
                <span className="text-gradient truncate">
                  {application.clipperName}
                </span>
                <Badge
                  variant="outline"
                  className={cn("gap-1.5 rounded-full", status.badge)}
                >
                  <span
                    className={cn(
                      "size-1.5 animate-pulse rounded-full",
                      status.dot,
                    )}
                  />
                  {status.label}
                </Badge>
              </DialogTitle>
              <DialogDescription className="truncate text-xs sm:text-sm">
                {application.clipperArtisticName
                  ? `@${application.clipperArtisticName} · `
                  : ""}
                Entrou{" "}
                {format(
                  new Date(application.createdAt),
                  "dd/MM/yyyy 'às' HH:mm",
                  { locale: ptBR },
                )}{" "}
                · Há {daysSince} dias
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ===== Corpo scrollável ===== */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          {/* Contato */}
          {(application.clipperEmail ||
            application.clipperPhone ||
            application.clipperCity ||
            application.clipperState) && (
            <SectionCard
              icon={<CalendarBlank className="size-4" weight="fill" />}
              title="Informações Gerais"
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {application.clipperEmail && (
                  <InfoItem
                    icon={<Envelope className="size-4" />}
                    label="Email"
                    value={application.clipperEmail}
                  />
                )}
                {application.clipperPhone && (
                  <InfoItem
                    icon={<Phone className="size-4" />}
                    label="Telefone"
                    value={application.clipperPhone}
                  />
                )}
                {(application.clipperCity || application.clipperState) && (
                  <InfoItem
                    icon={<MapPin className="size-4" />}
                    label="Localização"
                    value={[application.clipperCity, application.clipperState]
                      .filter(Boolean)
                      .join(", ")}
                  />
                )}
              </div>
            </SectionCard>
          )}

          {/* Contas sociais */}
          {application.socialAccounts &&
            application.socialAccounts.length > 0 && (
              <SectionCard
                icon={<UsersThree className="size-4" weight="fill" />}
                title="Contas Sociais"
                action={
                  <span className="text-muted-foreground text-[11px]">
                    {application.socialAccounts.length}{" "}
                    {application.socialAccounts.length === 1
                      ? "conta"
                      : "contas"}
                  </span>
                }
              >
                <div className="flex flex-col gap-2.5">
                  {application.socialAccounts.map((account) => {
                    const config =
                      platformConfig[account.platform as PlatformKey]
                    const PlatformIcon = config?.icon
                    const profileUrl =
                      account.profileUrl ??
                      (account.username
                        ? PLATFORM_URLS[account.platform]?.(account.username)
                        : undefined)
                    return (
                      <div
                        key={account.id}
                        className={cn(
                          "relative rounded-2xl border p-3 sm:p-4",
                          account.isPrimary
                            ? "border-brand-cyan/30 not-dark:border-primary/30 bg-muted/20"
                            : "border-border/60 bg-muted/10",
                        )}
                      >
                        {account.isPrimary && (
                          <Badge
                            variant="outline"
                            className="absolute -top-2.5 right-3 gap-1 rounded-full border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-600 backdrop-blur dark:text-amber-400"
                          >
                            <Crown className="size-2.5" weight="fill" />
                            Principal
                          </Badge>
                        )}
                        <div className="flex items-center gap-3">
                          {config && PlatformIcon && (
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11",
                                config.bgColor,
                              )}
                            >
                              <PlatformIcon
                                className={cn("size-5", config.color)}
                              />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                              <span className="truncate">
                                @{account.username.replace("@", "")}
                              </span>
                              {account.isVerified && (
                                <SealCheck
                                  className="size-3.5 shrink-0 text-sky-500"
                                  weight="fill"
                                />
                              )}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {config?.label ?? account.platform}
                              {account.followers != null &&
                                account.followers > 0 && (
                                  <>
                                    {" · "}
                                    <span className="text-foreground font-semibold">
                                      {formatNumber(account.followers)}
                                    </span>{" "}
                                    seguidores
                                  </>
                                )}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                              {account.postsCount}{" "}
                              {account.postsCount === 1 ? "post" : "posts"} ·{" "}
                              {account.eligiblePostsCount}{" "}
                              {account.eligiblePostsCount === 1
                                ? "elegível"
                                : "elegíveis"}{" "}
                              · {formatNumber(account.totalViews)} views
                            </p>
                          </div>
                          {profileUrl && (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0 cursor-pointer rounded-xl"
                            >
                              <a
                                href={profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowSquareOut className="size-3.5" />
                                <span className="hidden sm:inline">Perfil</span>
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}

          {/* Performance */}
          {application.status === "APPROVED" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PerformanceCard
                icon={<Play className="size-4" weight="fill" />}
                label="Posts"
                value={String(application.postsCount)}
                sub={`${application.eligiblePostsCount} ${
                  application.eligiblePostsCount === 1
                    ? "elegível"
                    : "elegíveis"
                }`}
                className="text-brand-cyan not-dark:text-primary"
              />
              <PerformanceCard
                icon={<Eye className="size-4" weight="fill" />}
                label="Views"
                value={formatNumber(application.totalViews)}
                className="text-violet-500 dark:text-violet-400"
              />
              <PerformanceCard
                icon={<Heart className="size-4" weight="fill" />}
                label="Likes"
                value={formatNumber(application.totalLikes)}
                className="text-pink-500 dark:text-pink-400"
              />
              <PerformanceCard
                icon={<CurrencyDollar className="size-4" weight="bold" />}
                label="Ganhos"
                value={formatCurrency(application.totalEarned)}
                className="text-emerald-600 dark:text-emerald-400"
              />
            </div>
          )}

          {/* Motivo da rejeição (aplicação rejeitada) */}
          {application.status === "REJECTED" && application.rejectionReason && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-red-500 dark:text-red-400">
                <Warning className="size-4" weight="fill" />
                Motivo da Rejeição
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {application.rejectionReason}
              </p>
            </div>
          )}

          {/* Notas de revisão */}
          {application.reviewNotes && (
            <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4">
              <p className="mb-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400">
                Notas de Revisão
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {application.reviewNotes}
              </p>
            </div>
          )}

          {/* Textarea de rejeição (apenas pendente) */}
          {application.status === "PENDING" && (
            <div className="border-border/60 bg-muted/10 flex flex-col gap-2.5 rounded-2xl border p-4">
              <Label
                htmlFor="rejection-reason"
                className="text-sm font-semibold"
              >
                Motivo da Rejeição (opcional, mas recomendado)
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="resize-none rounded-xl"
              />
            </div>
          )}

          {/* Histórico financeiro */}
          {allTransactionsData &&
            allTransactionsData.transactions.length > 0 && (
              <SectionCard
                icon={<Wallet className="size-4" weight="fill" />}
                title="Histórico Financeiro"
                action={
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-600 dark:text-sky-400"
                    >
                      <Pulse className="size-2.5" weight="bold" />
                      {allTransactionsData.totalCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                    >
                      <CurrencyDollar className="size-2.5" weight="bold" />
                      {formatCurrency(allTransactionsData.walletBalance)}
                    </Badge>
                  </div>
                }
              >
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="bg-muted/40 grid h-9 w-full grid-cols-2 rounded-xl p-1">
                    <TabsTrigger
                      value="all"
                      className="cursor-pointer gap-1.5 rounded-lg text-xs font-semibold"
                    >
                      <Wallet className="size-3.5" weight="fill" />
                      Todas ({allTransactionsData.totalCount})
                    </TabsTrigger>
                    <TabsTrigger
                      value="campaign"
                      className="cursor-pointer gap-1.5 rounded-lg text-xs font-semibold"
                    >
                      <Trophy className="size-3.5" weight="fill" />
                      Competição ({campaignTransactionsData?.totalCount ?? 0})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="all"
                    className="mt-2.5 flex max-h-[300px] flex-col gap-1.5 overflow-y-auto"
                  >
                    {allTransactionsData.transactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </TabsContent>

                  <TabsContent
                    value="campaign"
                    className="mt-2.5 flex max-h-[300px] flex-col gap-1.5 overflow-y-auto"
                  >
                    {campaignTransactionsData &&
                    campaignTransactionsData.transactions.length > 0 ? (
                      <>
                        <div className="mb-1 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                                Total Ganho
                              </p>
                              <p className="text-xl font-black text-emerald-600 tabular-nums dark:text-emerald-400">
                                {formatCurrency(
                                  campaignTransactionsData.totalEarned,
                                )}
                              </p>
                            </div>
                            <Trophy
                              className="size-10 text-emerald-500 opacity-20"
                              weight="fill"
                            />
                          </div>
                        </div>
                        {campaignTransactionsData.transactions.map(
                          (transaction) => (
                            <TransactionRow
                              key={transaction.id}
                              transaction={transaction}
                              formatCurrency={formatCurrency}
                            />
                          ),
                        )}
                      </>
                    ) : (
                      <div className="py-8 text-center">
                        <Trophy
                          className="text-muted-foreground mx-auto mb-2 size-10 opacity-30"
                          weight="fill"
                        />
                        <p className="text-muted-foreground text-xs font-medium">
                          Nenhuma transação nesta competição
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-[10px]">
                          Ainda não recebeu pagamentos desta competição
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </SectionCard>
            )}

          {/* Sem transações */}
          {allTransactionsData &&
            allTransactionsData.transactions.length === 0 &&
            application.status === "APPROVED" && (
              <div className="border-border/60 rounded-2xl border border-dashed py-8 text-center">
                <Wallet
                  className="text-muted-foreground mx-auto mb-2 size-10 opacity-30"
                  weight="fill"
                />
                <p className="text-muted-foreground text-xs font-medium">
                  Nenhuma transação encontrada
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Ainda não possui histórico financeiro
                </p>
              </div>
            )}
        </div>

        {/* ===== Footer ===== */}
        <div className="border-border/60 flex shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full cursor-pointer rounded-xl sm:w-auto"
            disabled={isMutating}
            onClick={() => {
              setRejectionReason("")
              onOpenChange(false)
            }}
          >
            Fechar
          </Button>
          {application.status === "PENDING" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full cursor-pointer gap-1.5 rounded-xl border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500 sm:w-auto"
                disabled={isMutating}
                onClick={handleReject}
              >
                {rejectApplication.isPending ? (
                  <Spinner className="size-3.5 animate-spin" />
                ) : (
                  <XCircle className="size-3.5" weight="fill" />
                )}
                Rejeitar
              </Button>
              <Button
                size="sm"
                className="h-9 w-full cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white hover:opacity-90 sm:w-auto"
                disabled={isMutating}
                onClick={handleApprove}
              >
                {approveApplication.isPending ? (
                  <Spinner className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="size-3.5" weight="fill" />
                )}
                Aprovar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ===== Blocos auxiliares ===== */

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
            {icon}
          </span>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function PerformanceCard({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  className?: string
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-1 rounded-2xl border px-3 py-3.5 text-center">
      <span className={className}>{icon}</span>
      <span
        className={cn("text-base font-black tabular-nums sm:text-lg", className)}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
      {sub && <span className="text-muted-foreground text-[9px]">{sub}</span>}
    </div>
  )
}

function TransactionRow({
  transaction,
  formatCurrency,
}: {
  transaction: AllTransaction | CampaignTransaction
  formatCurrency: (value: number) => string
}) {
  const config = TRANSACTION_TYPE_CONFIG[transaction.type]
  const Icon = config?.icon ?? CurrencyDollar
  const amount = Number(transaction.amount)
  const isCredit = amount > 0
  return (
    <div className="border-border/40 bg-muted/20 hover:border-border/60 flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 transition-colors">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isCredit ? "bg-emerald-500/10" : "bg-red-500/10",
        )}
      >
        <Icon className={cn("size-4", config?.color)} weight="fill" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold">
            {config?.label ?? transaction.type}
          </p>
          {transaction.status === "COMPLETED" && (
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
          )}
          {transaction.status === "PROCESSING" && (
            <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
          )}
        </div>
        <p className="text-muted-foreground truncate text-[10px]">
          {transaction.description}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="text-muted-foreground text-[9px]">
            {format(new Date(transaction.createdAt), "dd/MM/yyyy HH:mm", {
              locale: ptBR,
            })}
          </p>
          {transaction.rankingPosition != null && (
            <span className="text-muted-foreground text-[9px]">
              {transaction.rankingPosition}º lugar
            </span>
          )}
        </div>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          isCredit
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        {isCredit ? "+" : ""}
        {formatCurrency(amount)}
      </p>
    </div>
  )
}
