"use client"

import * as React from "react"
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  Bank,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Clock,
  Coins,
  Crown,
  CurrencyDollar,
  DiscordLogo,
  Envelope,
  Eye,
  FilmSlate,
  Gift,
  Key,
  Link as LinkIcon,
  LockKey,
  MapPin,
  PencilSimple,
  Phone,
  PiggyBank,
  Prohibit,
  Quotes,
  Receipt,
  SealCheck,
  ShieldWarning,
  Sparkle,
  Trophy,
  UserCircle,
  Wallet,
  WarningCircle,
  Wrench,
  XCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bone } from "@/components/shared/skeletons"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import {
  PIX_KEY_TYPE_OPTIONS,
  inferPixKeyType,
  normalizePixKeyForType,
  pixKeyPlaceholder,
  type PixKeyType,
} from "@/lib/pix-key"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { useMaskedCurrency } from "@/contexts/financial-visibility-context"

import { STATUS_CONFIG, type Clipper, type ClipperStatus } from "./clippers"

const formatDateTime = (date: Date | string) =>
  format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

/** Rótulo em pt-BR do tipo de chave PIX. */
const pixKeyTypeLabel = (type: PixKeyType) =>
  PIX_KEY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Chave"

const PLATFORM_URLS: Record<PlatformKey, (username: string) => string> = {
  INSTAGRAM: (u) => `https://instagram.com/${u.replace("@", "")}`,
  TIKTOK: (u) => `https://tiktok.com/@${u.replace("@", "")}`,
  YOUTUBE: (u) => `https://youtube.com/@${u.replace("@", "")}`,
  KWAI: (u) => `https://kwai.com/@${u.replace("@", "")}`,
  FACEBOOK: (u) => `https://facebook.com/${u.replace("@", "")}`,
}

const TRANSACTION_TYPES: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  PRIZE_CREDIT: {
    label: "Prêmio",
    icon: Trophy,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  BONUS: {
    label: "Bônus",
    icon: Gift,
    className: "text-cyan-600 dark:text-cyan-400",
  },
  ADJUSTMENT: {
    label: "Ajuste",
    icon: Wrench,
    className: "text-amber-600 dark:text-amber-400",
  },
  WITHDRAWAL_REQUEST: {
    label: "Saque Solicitado",
    icon: Bank,
    className: "text-amber-600 dark:text-amber-400",
  },
  WITHDRAWAL_APPROVED: {
    label: "Saque Aprovado",
    icon: Bank,
    className: "text-sky-600 dark:text-sky-400",
  },
  WITHDRAWAL_REJECTED: {
    label: "Saque Rejeitado",
    icon: XCircle,
    className: "text-red-600 dark:text-red-400",
  },
  WITHDRAWAL_COMPLETED: {
    label: "Saque Concluído",
    icon: CheckCircle,
    className: "text-violet-600 dark:text-violet-400",
  },
  WITHDRAWAL_CANCELLED: {
    label: "Saque Cancelado",
    icon: XCircle,
    className: "text-muted-foreground",
  },
  REFUND: {
    label: "Estorno",
    icon: ArrowCounterClockwise,
    className: "text-cyan-600 dark:text-cyan-400",
  },
  FEE: {
    label: "Taxa",
    icon: Receipt,
    className: "text-red-600 dark:text-red-400",
  },
}

const TRANSACTION_STATUS: Record<string, { label: string; badge: string }> = {
  PENDING: {
    label: "Pendente",
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  PROCESSING: {
    label: "Processando",
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  COMPLETED: {
    label: "Concluída",
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  REJECTED: {
    label: "Rejeitada",
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
  },
  CANCELLED: {
    label: "Cancelada",
    badge: "border-border bg-muted/50 text-muted-foreground",
  },
  FAILED: {
    label: "Falhou",
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
  },
}

type TransactionTypeFilter =
  | "ALL"
  | "PRIZE_CREDIT"
  | "BONUS"
  | "ADJUSTMENT"
  | "WITHDRAWAL_REQUEST"
  | "WITHDRAWAL_COMPLETED"
  | "REFUND"

type TransactionStatusFilter =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"

interface SeeClipperDialogProps {
  clipper: Clipper | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SeeClipperDialog({
  clipper,
  open,
  onOpenChange,
}: SeeClipperDialogProps) {
  const utils = api.useUtils()
  const { maskBRLExact: formatCurrency } = useMaskedCurrency()
  const enabled = open && !!clipper

  /* ===== Carteira ===== */
  const { data: wallet, isLoading: loadingWallet } =
    api.clipper.getWallet.useQuery(
      { clipperProfileId: clipper?.id ?? "" },
      { enabled },
    )
  const { data: walletStats } = api.clipper.getWalletStats.useQuery(
    { clipperProfileId: clipper?.id ?? "" },
    { enabled },
  )

  /* ===== Transações ===== */
  const [transactionPage, setTransactionPage] = React.useState(1)
  const [transactionType, setTransactionType] =
    React.useState<TransactionTypeFilter>("ALL")
  const [transactionStatus, setTransactionStatus] =
    React.useState<TransactionStatusFilter>("ALL")

  React.useEffect(() => {
    setTransactionPage(1)
  }, [transactionType, transactionStatus])

  const { data: transactionsData, isLoading: loadingTransactions } =
    api.clipper.getTransactions.useQuery(
      {
        clipperProfileId: clipper?.id ?? "",
        page: transactionPage,
        pageSize: 10,
        type: transactionType,
        status: transactionStatus,
      },
      { enabled },
    )

  /* ===== Contas sociais ===== */
  const { data: socialAccounts, isLoading: loadingSocial } =
    api.clipper.getClipperSocialAccounts.useQuery(
      { clipperProfileId: clipper?.id ?? "" },
      { enabled },
    )

  /* ===== Edição de dados pessoais ===== */
  const [isEditing, setIsEditing] = React.useState(false)
  const [editArtisticName, setEditArtisticName] = React.useState("")
  const [editPhone, setEditPhone] = React.useState("")
  const [editPixKey, setEditPixKey] = React.useState("")
  const [editPixKeyType, setEditPixKeyType] = React.useState<PixKeyType>("CPF")

  React.useEffect(() => {
    if (clipper) {
      setEditArtisticName(clipper.artisticName ?? "")
      setEditPhone(clipper.phone ?? "")
      setEditPixKey(clipper.pixKey ?? "")
      setEditPixKeyType(inferPixKeyType(clipper.pixKey))
      setIsEditing(false)
    }
  }, [clipper])

  const updateInfoMutation = api.admin.updateClipperInfo.useMutation({
    onSuccess: () => {
      toast.success("Informações atualizadas!")
      setIsEditing(false)
      void utils.clipper.getAll.invalidate()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao atualizar informações"),
  })

  /* ===== Chave PIX: validação em tempo real por tipo ===== */
  const trimmedPixKey = editPixKey.trim()
  const pixKeyCheck = trimmedPixKey
    ? normalizePixKeyForType(trimmedPixKey, editPixKeyType)
    : null
  const pixKeyError = pixKeyCheck && !pixKeyCheck.ok ? pixKeyCheck.error : null

  const handleSaveClipperInfo = () => {
    if (!clipper) return

    // Sem chave = remoção; com chave = só salva se for válida para o tipo
    let pixKeyToSave: string | null = null
    if (trimmedPixKey) {
      const normalized = normalizePixKeyForType(trimmedPixKey, editPixKeyType)
      if (!normalized.ok) {
        toast.error(normalized.error)
        return
      }
      pixKeyToSave = normalized.value
    }

    updateInfoMutation.mutate({
      clipperProfileId: clipper.id,
      artisticName: editArtisticName || null,
      phone: editPhone || null,
      pixKey: pixKeyToSave,
    })
  }

  /* ===== Alterar senha ===== */
  const [isPasswordOpen, setIsPasswordOpen] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  const changePasswordMutation = api.admin.changeUserPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!")
      setIsPasswordOpen(false)
      setNewPassword("")
      setConfirmPassword("")
    },
    onError: (error) => toast.error(error.message || "Erro ao alterar senha"),
  })

  const handleChangePassword = () => {
    if (!clipper?.userId) {
      toast.error("ID do usuário não encontrado")
      return
    }
    if (newPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem")
      return
    }
    changePasswordMutation.mutate({ userId: clipper.userId, newPassword })
  }

  /* ===== Ban / Unban ===== */
  const [isBanOpen, setIsBanOpen] = React.useState(false)
  const [isUnbanOpen, setIsUnbanOpen] = React.useState(false)

  const banMutation = api.clipper.ban.useMutation({
    onSuccess: () => {
      toast.success("Clipador banido com sucesso!")
      setIsBanOpen(false)
      onOpenChange(false)
      void utils.clipper.getAll.invalidate()
      void utils.clipper.getStats.invalidate()
    },
    onError: (error) => toast.error(error.message || "Erro ao banir clipador"),
  })

  const unbanMutation = api.clipper.unban.useMutation({
    onSuccess: () => {
      toast.success("Clipador desbanido com sucesso!")
      setIsUnbanOpen(false)
      onOpenChange(false)
      void utils.clipper.getAll.invalidate()
      void utils.clipper.getStats.invalidate()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao desbanir clipador"),
  })

  if (!clipper) return null

  const status =
    STATUS_CONFIG[clipper.verificationStatus as ClipperStatus] ??
    STATUS_CONFIG.UNVERIFIED
  const name = clipper.artisticName?.trim() || clipper.fullName
  const nameInitials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const isBanned = clipper.verificationStatus === "BANNED"
  const allTermsAccepted =
    clipper.isOver18 &&
    clipper.agreeToTerms &&
    clipper.agreeToCompliance &&
    clipper.agreeToPublicProfile &&
    clipper.agreeToDataProcessing

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-5xl">
          {/* ===== Header ===== */}
          <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-13 shrink-0 rounded-2xl sm:size-15">
                <AvatarImage
                  src={clipper.user.imageUrl ?? undefined}
                  alt={name}
                />
                <AvatarFallback className="bg-gradient-custom rounded-2xl text-base font-bold text-[#04222A]">
                  {nameInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold tracking-tight sm:text-lg">
                  <span className="truncate">{name}</span>
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
                  {clipper.fullName} • {clipper.user.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* ===== Corpo scrollável ===== */}
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
            {/* Cards de carteira */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <WalletCard
                icon={<Wallet className="size-4" weight="fill" />}
                label="Saldo"
                value={wallet?.balance ?? 0}
                isLoading={loadingWallet}
                delay={0}
                className="text-cyan-600 dark:text-cyan-400"
              />
              <WalletCard
                icon={<CurrencyDollar className="size-4" weight="bold" />}
                label="Total Ganho"
                value={wallet?.totalEarned ?? 0}
                isLoading={loadingWallet}
                delay={100}
                className="text-emerald-600 dark:text-emerald-400"
              />
              <WalletCard
                icon={<Bank className="size-4" weight="fill" />}
                label="Sacado"
                value={wallet?.totalWithdrawn ?? 0}
                isLoading={loadingWallet}
                delay={200}
                className="text-violet-600 dark:text-violet-400"
              />
              <WalletCard
                icon={<Clock className="size-4" weight="fill" />}
                label="Pendente"
                value={wallet?.pendingWithdraw ?? 0}
                isLoading={loadingWallet}
                delay={300}
                className="text-amber-600 dark:text-amber-400"
              />
            </div>

            {/* Banner de status */}
            {clipper.verificationStatus === "VERIFIED" &&
              clipper.verifiedAt && (
                <StatusBanner
                  icon={<SealCheck className="size-4" weight="fill" />}
                  className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  Verificado em {formatDateTime(clipper.verifiedAt)}
                </StatusBanner>
              )}
            {clipper.verificationStatus === "PENDING" && (
              <StatusBanner
                icon={<Clock className="size-4" weight="fill" />}
                className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                Submissão enviada em {formatDateTime(clipper.updatedAt)} —
                aguardando verificação
              </StatusBanner>
            )}
            {clipper.verificationStatus === "REJECTED" && (
              <StatusBanner
                icon={<XCircle className="size-4" weight="fill" />}
                className="border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400"
              >
                Cadastro rejeitado — o clipador pode reenviar a submissão
              </StatusBanner>
            )}
            {isBanned && (
              <StatusBanner
                icon={<Prohibit className="size-4" weight="fill" />}
                className="border-red-900/40 bg-red-900/15 text-red-700 dark:text-red-300"
              >
                Este clipador está banido da plataforma
              </StatusBanner>
            )}

            {/* ===== Tabs ===== */}
            <Tabs defaultValue="overview" className="w-full">
              <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                <TabsList className="bg-muted/40 flex h-auto w-max flex-nowrap justify-start gap-1 rounded-2xl p-1">
                  {[
                    { value: "overview", label: "Visão Geral" },
                    { value: "personal", label: "Dados Pessoais" },
                    { value: "social", label: "Plataformas" },
                    { value: "performance", label: "Desempenho" },
                    { value: "portfolio", label: "Portfólio" },
                    { value: "terms", label: "Termos" },
                    { value: "wallet", label: "Carteira" },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex-none cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ===== Visão Geral ===== */}
              <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoItem
                    icon={<Envelope className="size-4" />}
                    label="E-mail"
                    value={clipper.user.email}
                  />
                  <InfoItem
                    icon={<Phone className="size-4" />}
                    label="Telefone"
                    value={clipper.phone || "—"}
                  />
                  <InfoItem
                    icon={<MapPin className="size-4" />}
                    label="Localização"
                    value={
                      [clipper.city, clipper.state, clipper.country]
                        .filter(Boolean)
                        .join(", ") || "—"
                    }
                  />
                  <InfoItem
                    icon={<CalendarBlank className="size-4" />}
                    label="Cadastro"
                    value={formatDateTime(clipper.createdAt)}
                  />
                </div>

                {/* Discord */}
                <SectionCard
                  icon={<DiscordLogo className="size-4" weight="fill" />}
                  title="Discord"
                >
                  {clipper.discordUsername || clipper.discordId ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-semibold">
                        {clipper.discordUsername || "—"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        ID: {clipper.discordId || "—"}
                      </p>
                      </div>
                      {clipper.discordId && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-9 cursor-pointer rounded-xl"
                        >
                          <a
                            href={`https://discord.com/users/${clipper.discordId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ArrowSquareOut className="size-3.5" />
                            Abrir no Discord
                          </a>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhuma conta Discord informada
                    </p>
                  )}
                </SectionCard>

                {/* Gerenciamento de acesso */}
                <SectionCard
                  icon={<Key className="size-4" weight="fill" />}
                  title="Gerenciamento de Acesso"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-muted-foreground text-sm">
                      Defina uma nova senha de acesso para este clipador.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 cursor-pointer rounded-xl"
                      onClick={() => setIsPasswordOpen(true)}
                    >
                      <LockKey className="size-3.5" />
                      Alterar Senha
                    </Button>
                  </div>
                </SectionCard>

                {/* Banimento */}
                <SectionCard
                  icon={<ShieldWarning className="size-4" weight="fill" />}
                  title="Banimento"
                  className={
                    isBanned
                      ? "border-red-900/40 bg-red-900/10"
                      : "border-red-500/20"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-muted-foreground text-sm">
                      {isBanned
                        ? "Este clipador está banido. Desbanir restaura o status de verificado."
                        : "Banir remove o clipador de todas as competições e bloqueia o acesso."}
                    </p>
                    {isBanned ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 cursor-pointer rounded-xl border-emerald-500/40 text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"
                        onClick={() => setIsUnbanOpen(true)}
                      >
                        <CheckCircle className="size-3.5" weight="fill" />
                        Desbanir Clipador
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 cursor-pointer rounded-xl border-red-500/40 text-red-600 hover:text-red-600 dark:text-red-400"
                        onClick={() => setIsBanOpen(true)}
                      >
                        <Prohibit className="size-3.5" weight="bold" />
                        Banir Clipador
                      </Button>
                    )}
                  </div>
                </SectionCard>
              </TabsContent>

              {/* ===== Dados Pessoais ===== */}
              <TabsContent value="personal" className="mt-4">
                <SectionCard
                  icon={<UserCircle className="size-4" weight="fill" />}
                  title="Dados Pessoais"
                  action={
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 cursor-pointer rounded-xl"
                          onClick={() => {
                            setIsEditing(false)
                            setEditArtisticName(clipper.artisticName ?? "")
                            setEditPhone(clipper.phone ?? "")
                            setEditPixKey(clipper.pixKey ?? "")
                            setEditPixKeyType(inferPixKeyType(clipper.pixKey))
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
                          disabled={updateInfoMutation.isPending || !!pixKeyError}
                          onClick={handleSaveClipperInfo}
                        >
                          {updateInfoMutation.isPending
                            ? "Salvando..."
                            : "Salvar"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 cursor-pointer rounded-xl"
                        onClick={() => setIsEditing(true)}
                      >
                        <PencilSimple className="size-3.5" />
                        Editar
                      </Button>
                    )
                  }
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldBlock label="Nome Completo">
                      <p className="text-sm font-medium">{clipper.fullName}</p>
                    </FieldBlock>
                    <FieldBlock label="E-mail">
                      <p className="truncate text-sm font-medium">
                        {clipper.user.email}
                      </p>
                    </FieldBlock>
                    <FieldBlock label="Localização">
                      <p className="text-sm font-medium">
                        {[clipper.city, clipper.state, clipper.country]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </FieldBlock>
                    <FieldBlock label="CPF">
                      <p className="text-sm font-medium">
                        {clipper.cpf || "—"}
                      </p>
                    </FieldBlock>
                    <FieldBlock label="Nome Artístico">
                      {isEditing ? (
                        <Input
                          value={editArtisticName}
                          onChange={(e) => setEditArtisticName(e.target.value)}
                          placeholder="Nome artístico"
                          className="h-9 rounded-xl"
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {clipper.artisticName || "—"}
                        </p>
                      )}
                    </FieldBlock>
                    <FieldBlock label="Telefone">
                      {isEditing ? (
                        <Input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="h-9 rounded-xl"
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {clipper.phone || "—"}
                        </p>
                      )}
                    </FieldBlock>
                    <FieldBlock label="Chave PIX" className="sm:col-span-2">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[9.5rem_1fr]">
                            <Select
                              value={editPixKeyType}
                              onValueChange={(value) =>
                                setEditPixKeyType(value as PixKeyType)
                              }
                            >
                              <SelectTrigger
                                aria-label="Tipo da chave PIX"
                                className="h-9 w-full cursor-pointer rounded-xl"
                              >
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {PIX_KEY_TYPE_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    className="cursor-pointer"
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={editPixKey}
                              onChange={(e) => setEditPixKey(e.target.value)}
                              placeholder={pixKeyPlaceholder(editPixKeyType)}
                              autoComplete="off"
                              spellCheck={false}
                              aria-label={`Chave PIX do tipo ${pixKeyTypeLabel(editPixKeyType)}`}
                              aria-invalid={!!pixKeyError}
                              aria-describedby={
                                pixKeyError ? "clipper-pix-error" : "clipper-pix-hint"
                              }
                              className={cn(
                                "h-9 min-w-0 rounded-xl",
                                pixKeyError && "border-destructive/60",
                              )}
                            />
                          </div>
                          {pixKeyError ? (
                            <p
                              id="clipper-pix-error"
                              role="alert"
                              className="text-destructive flex items-start gap-1.5 text-xs"
                            >
                              <WarningCircle
                                aria-hidden
                                className="mt-px size-3.5 shrink-0"
                                weight="fill"
                              />
                              <span className="min-w-0">{pixKeyError}</span>
                            </p>
                          ) : (
                            <p
                              id="clipper-pix-hint"
                              className="text-muted-foreground text-xs"
                            >
                              A chave é normalizada ao salvar (telefone com +55,
                              e-mail em minúsculas). Deixe em branco para
                              remover.
                            </p>
                          )}
                        </div>
                      ) : clipper.pixKey ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="shrink-0 rounded-full border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                          >
                            {pixKeyTypeLabel(inferPixKeyType(clipper.pixKey))}
                          </Badge>
                          <p className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                            {clipper.pixKey}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-medium">—</p>
                      )}
                    </FieldBlock>
                  </div>
                </SectionCard>
              </TabsContent>

              {/* ===== Plataformas ===== */}
              <TabsContent value="social" className="mt-4">
                {loadingSocial ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Bone
                            delay={index * 120}
                            className="size-10 shrink-0 rounded-xl"
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <Bone
                              delay={index * 120 + 60}
                              className="h-3.5 w-28 max-w-full"
                            />
                            <Bone
                              delay={index * 120 + 120}
                              className="h-3 w-16 rounded-full"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Bone
                            delay={index * 120 + 180}
                            className="h-[22px] w-20 rounded-full"
                          />
                          <Bone
                            delay={index * 120 + 240}
                            className="h-[22px] w-14 rounded-full"
                          />
                        </div>
                        <Bone
                          delay={index * 120 + 300}
                          className="h-9 w-full rounded-xl"
                        />
                      </div>
                    ))}
                  </div>
                ) : !socialAccounts || socialAccounts.length === 0 ? (
                  <EmptyBlock
                    icon={<FilmSlate className="size-6" weight="fill" />}
                    title="Nenhuma conta vinculada"
                    subtitle="Este clipador ainda não vinculou contas de redes sociais"
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {socialAccounts.map((account) => {
                      const config =
                        platformConfig[account.platform as PlatformKey]
                      const PlatformIcon = config?.icon
                      const url =
                        account.profileUrl ??
                        PLATFORM_URLS[account.platform as PlatformKey]?.(
                          account.username,
                        )
                      return (
                        <div
                          key={account.id}
                          className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4"
                        >
                          <div className="flex items-center gap-3">
                            {config && PlatformIcon && (
                              <span
                                className={cn(
                                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                  config.bgColor,
                                )}
                              >
                                <PlatformIcon
                                  className={cn("size-5", config.color)}
                                />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                @{account.username.replace("@", "")}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {config?.label ?? account.platform}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {account.isPrimary && (
                              <Badge
                                variant="outline"
                                className="gap-1 rounded-full border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              >
                                <Crown className="size-3" weight="fill" />
                                Principal
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full",
                                account.isActive
                                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "border-border bg-muted/50 text-muted-foreground",
                              )}
                            >
                              {account.isActive ? "Ativa" : "Inativa"}
                            </Badge>
                            {account.isVerified && (
                              <Badge
                                variant="outline"
                                className="gap-1 rounded-full border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400"
                              >
                                <SealCheck className="size-3" weight="fill" />
                                Verificada
                              </Badge>
                            )}
                          </div>
                          {url && (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-9 w-full cursor-pointer rounded-xl"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowSquareOut className="size-3.5" />
                                Abrir no {config?.label ?? account.platform}
                              </a>
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ===== Desempenho ===== */}
              <TabsContent
                value="performance"
                className="mt-4 flex flex-col gap-4"
              >
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard
                    icon={<Eye className="size-4" weight="fill" />}
                    label="Média de Views"
                    value={
                      clipper.avgViews != null
                        ? clipper.avgViews.toLocaleString("pt-BR")
                        : "N/A"
                    }
                  />
                  <MetricCard
                    icon={<Trophy className="size-4" weight="fill" />}
                    label="Melhor Vídeo"
                    value={
                      clipper.bestVideoViews != null
                        ? clipper.bestVideoViews.toLocaleString("pt-BR")
                        : "N/A"
                    }
                  />
                  <MetricCard
                    icon={<ChartLineUp className="size-4" weight="bold" />}
                    label="Engajamento"
                    value={
                      clipper.avgEngagementRate != null
                        ? `${clipper.avgEngagementRate.toFixed(1)}%`
                        : "N/A"
                    }
                  />
                  <MetricCard
                    icon={<Sparkle className="size-4" weight="fill" />}
                    label="Score"
                    value={
                      clipper.autoScore != null
                        ? clipper.autoScore.toFixed(1)
                        : "N/A"
                    }
                  />
                </div>
                {clipper.bestVideoUrl && (
                  <SectionCard
                    icon={<Trophy className="size-4" weight="fill" />}
                    title="Melhor Vídeo"
                  >
                    <a
                      href={clipper.bestVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-cyan not-dark:text-primary inline-flex items-center gap-1.5 text-sm font-semibold break-all hover:opacity-80"
                    >
                      <ArrowSquareOut className="size-4 shrink-0" />
                      {clipper.bestVideoUrl}
                    </a>
                  </SectionCard>
                )}
              </TabsContent>

              {/* ===== Portfólio ===== */}
              <TabsContent
                value="portfolio"
                className="mt-4 flex flex-col gap-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SectionCard
                    icon={<Sparkle className="size-4" weight="fill" />}
                    title="Nichos"
                  >
                    {clipper.niches.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {clipper.niches.map((niche) => (
                          <Badge
                            key={niche}
                            variant="outline"
                            className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary rounded-full"
                          >
                            {niche}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">—</p>
                    )}
                  </SectionCard>
                  <SectionCard
                    icon={<Wrench className="size-4" weight="fill" />}
                    title="Ferramentas"
                  >
                    {clipper.tools.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {clipper.tools.map((tool) => (
                          <Badge
                            key={tool}
                            variant="outline"
                            className="rounded-full"
                          >
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">—</p>
                    )}
                  </SectionCard>
                  <SectionCard
                    icon={<CalendarBlank className="size-4" weight="fill" />}
                    title="Frequência de Postagem"
                  >
                    <p className="text-sm font-medium">
                      {clipper.postingFrequency || "—"}
                    </p>
                  </SectionCard>
                  <SectionCard
                    icon={<Clock className="size-4" weight="fill" />}
                    title="Compromisso Semanal"
                  >
                    <p className="text-sm font-medium">
                      {clipper.weeklyCommitment || "—"}
                    </p>
                  </SectionCard>
                </div>

                {clipper.motivationText && (
                  <SectionCard
                    icon={<Quotes className="size-4" weight="fill" />}
                    title="Motivação"
                  >
                    <blockquote className="border-brand-cyan/40 not-dark:border-primary/40 border-l-2 pl-3 text-sm leading-relaxed italic">
                      {clipper.motivationText}
                    </blockquote>
                  </SectionCard>
                )}

                <SectionCard
                  icon={<LinkIcon className="size-4" weight="bold" />}
                  title="Links do Portfólio"
                >
                  {clipper.portfolioLinks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {clipper.portfolioLinks.map((link) => (
                        <a
                          key={link}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-cyan not-dark:text-primary inline-flex items-center gap-1.5 text-sm break-all hover:opacity-80"
                        >
                          <ArrowSquareOut className="size-3.5 shrink-0" />
                          {link}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhum link enviado
                    </p>
                  )}
                </SectionCard>
              </TabsContent>

              {/* ===== Termos ===== */}
              <TabsContent value="terms" className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <TermRow accepted={clipper.isOver18} label="Maior de 18 anos" />
                  <TermRow
                    accepted={clipper.agreeToTerms}
                    label="Termos de Uso"
                  />
                  <TermRow
                    accepted={clipper.agreeToCompliance}
                    label="Regras das Competições"
                  />
                  <TermRow
                    accepted={clipper.agreeToPublicProfile}
                    label="Perfil Público"
                  />
                  <TermRow
                    accepted={clipper.agreeToDataProcessing}
                    label="Processamento de Dados"
                  />
                </div>
                {allTermsAccepted && (
                  <StatusBanner
                    icon={<CheckCircle className="size-4" weight="fill" />}
                    className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    Todos os termos foram aceitos por este clipador
                  </StatusBanner>
                )}
              </TabsContent>

              {/* ===== Carteira ===== */}
              <TabsContent value="wallet" className="mt-4 flex flex-col gap-4">
                {wallet?.blockedAt && (
                  <StatusBanner
                    icon={<ShieldWarning className="size-4" weight="fill" />}
                    className="border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400"
                  >
                    Carteira bloqueada em {formatDateTime(wallet.blockedAt)}
                    {wallet.blockReason ? ` — ${wallet.blockReason}` : ""}
                  </StatusBanner>
                )}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <MetricCard
                    icon={<Receipt className="size-4" weight="fill" />}
                    label="Transações"
                    value={String(walletStats?.totalTransactions ?? 0)}
                  />
                  <MetricCard
                    icon={<Coins className="size-4" weight="fill" />}
                    label="Créditos"
                    value={formatCurrency(walletStats?.totalCredits ?? 0)}
                  />
                  <MetricCard
                    icon={<Bank className="size-4" weight="fill" />}
                    label="Saques"
                    value={String(walletStats?.totalWithdrawals ?? 0)}
                  />
                  <MetricCard
                    icon={<Clock className="size-4" weight="fill" />}
                    label="Saques Pendentes"
                    value={String(walletStats?.pendingWithdrawals ?? 0)}
                  />
                  <MetricCard
                    icon={<PiggyBank className="size-4" weight="fill" />}
                    label="Saques Concluídos"
                    value={String(walletStats?.completedWithdrawals ?? 0)}
                    className="col-span-2 lg:col-span-1"
                  />
                </div>

                {/* Filtros de transações */}
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <Select
                    value={transactionType}
                    onValueChange={(value) =>
                      setTransactionType(value as TransactionTypeFilter)
                    }
                  >
                    <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-52">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">Todos os Tipos</SelectItem>
                      <SelectItem value="PRIZE_CREDIT">Prêmio</SelectItem>
                      <SelectItem value="BONUS">Bônus</SelectItem>
                      <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                      <SelectItem value="WITHDRAWAL_REQUEST">
                        Saque Solicitado
                      </SelectItem>
                      <SelectItem value="WITHDRAWAL_COMPLETED">
                        Saque Concluído
                      </SelectItem>
                      <SelectItem value="REFUND">Estorno</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={transactionStatus}
                    onValueChange={(value) =>
                      setTransactionStatus(value as TransactionStatusFilter)
                    }
                  >
                    <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-48">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">Todos os Status</SelectItem>
                      <SelectItem value="PENDING">Pendente</SelectItem>
                      <SelectItem value="PROCESSING">Processando</SelectItem>
                      <SelectItem value="COMPLETED">Concluída</SelectItem>
                      <SelectItem value="REJECTED">Rejeitada</SelectItem>
                      <SelectItem value="CANCELLED">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                  {transactionsData && (
                    <p className="text-muted-foreground text-xs sm:ml-auto">
                      {transactionsData.total} transações no total
                    </p>
                  )}
                </div>

                {/* Lista de transações */}
                {loadingTransactions ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3"
                      >
                        <Bone
                          delay={index * 100}
                          className="size-9 shrink-0 rounded-xl"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <Bone
                            delay={index * 100 + 50}
                            className="h-3.5 w-24 max-w-full"
                          />
                          <Bone
                            delay={index * 100 + 100}
                            className="h-3 w-40 max-w-full rounded-full"
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5">
                          <Bone
                            delay={index * 100 + 150}
                            className="hidden h-[18px] w-16 rounded-full sm:block"
                          />
                          <Bone
                            delay={index * 100 + 200}
                            className="h-4 w-16"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !transactionsData ||
                  transactionsData.transactions.length === 0 ? (
                  <EmptyBlock
                    icon={<Receipt className="size-6" weight="fill" />}
                    title="Nenhuma transação encontrada"
                    subtitle="Ajuste os filtros ou aguarde novas movimentações"
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {transactionsData.transactions.map((transaction) => {
                      const typeConfig = TRANSACTION_TYPES[transaction.type] ?? {
                        label: transaction.type,
                        icon: Receipt,
                        className: "text-muted-foreground",
                      }
                      const statusConfig =
                        TRANSACTION_STATUS[transaction.status] ??
                        TRANSACTION_STATUS.PENDING!
                      const TypeIcon = typeConfig.icon
                      const isCredit = transaction.amount > 0
                      return (
                        <div
                          key={transaction.id}
                          className="border-border/60 bg-muted/20 flex flex-wrap items-center gap-3 rounded-2xl border px-3.5 py-3"
                        >
                          <span
                            className={cn(
                              "bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-xl",
                              typeConfig.className,
                            )}
                          >
                            <TypeIcon className="size-4" weight="fill" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                              {typeConfig.label}
                              {transaction.rankingPosition != null && (
                                <Badge
                                  variant="outline"
                                  className="gap-0.5 rounded-full border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400"
                                >
                                  <Trophy className="size-2.5" weight="fill" />
                                  {transaction.rankingPosition}º
                                </Badge>
                              )}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {transaction.description} ·{" "}
                              {formatDateTime(transaction.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-[10px]",
                                statusConfig.badge,
                              )}
                            >
                              {statusConfig.label}
                            </Badge>
                            <span
                              className={cn(
                                "text-sm font-bold tabular-nums",
                                isCredit
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400",
                              )}
                            >
                              {isCredit ? "+" : ""}
                              {formatCurrency(transaction.amount)}
                            </span>
                          </div>
                        </div>
                      )
                    })}

                    {/* Paginação */}
                    {transactionsData.totalPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-muted-foreground text-xs">
                          Página {transactionsData.page} de{" "}
                          {transactionsData.totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 cursor-pointer rounded-xl"
                            disabled={transactionPage <= 1}
                            onClick={() =>
                              setTransactionPage((page) => page - 1)
                            }
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 cursor-pointer rounded-xl"
                            disabled={
                              transactionPage >= transactionsData.totalPages
                            }
                            onClick={() =>
                              setTransactionPage((page) => page + 1)
                            }
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Alterar Senha ===== */}
      <AlertDialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LockKey className="size-5" weight="fill" />
              Alterar Senha
            </AlertDialogTitle>
            <AlertDialogDescription>
              Defina uma nova senha de acesso para {name}. O clipador poderá
              usá-la no próximo login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="text-muted-foreground flex flex-col gap-1 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  newPassword.length >= 8 &&
                    "text-emerald-600 dark:text-emerald-400",
                )}
              >
                <CheckCircle
                  className="size-3.5"
                  weight={newPassword.length >= 8 ? "fill" : "regular"}
                />
                Mínimo 8 caracteres
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  newPassword.length > 0 &&
                    newPassword === confirmPassword &&
                    "text-emerald-600 dark:text-emerald-400",
                )}
              >
                <CheckCircle
                  className="size-3.5"
                  weight={
                    newPassword.length > 0 && newPassword === confirmPassword
                      ? "fill"
                      : "regular"
                  }
                />
                Senhas coincidem
              </span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer rounded-xl"
              onClick={() => {
                setNewPassword("")
                setConfirmPassword("")
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              disabled={
                changePasswordMutation.isPending ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
              onClick={(e) => {
                e.preventDefault()
                handleChangePassword()
              }}
            >
              {changePasswordMutation.isPending
                ? "Alterando..."
                : "Alterar Senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Banir ===== */}
      <AlertDialog open={isBanOpen} onOpenChange={setIsBanOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Prohibit className="size-5" weight="fill" />
              Banir Clipador
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja banir <strong>{name}</strong>? Esta ação:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
            {[
              "Remove o clipador de todas as competições ativas",
              "Bloqueia o acesso à plataforma",
              "Suspende pagamentos e saques pendentes",
              "Marca o perfil como banido permanentemente",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <XCircle
                  className="mt-0.5 size-3.5 shrink-0 text-red-500"
                  weight="fill"
                />
                {item}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700"
              disabled={banMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                banMutation.mutate({ id: clipper.id })
              }}
            >
              {banMutation.isPending ? "Banindo..." : "Banir Clipador"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Desbanir ===== */}
      <AlertDialog open={isUnbanOpen} onOpenChange={setIsUnbanOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-5" weight="fill" />
              Desbanir Clipador
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desbanir <strong>{name}</strong>? Esta
              ação:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
            {[
              "Restaura o status de verificado",
              "Libera o acesso à plataforma",
              "Permite participar de novas competições",
              "Reativa a carteira e os saques",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-500"
                  weight="fill"
                />
                {item}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              disabled={unbanMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                unbanMutation.mutate({ id: clipper.id })
              }}
            >
              {unbanMutation.isPending ? "Desbanindo..." : "Desbanir Clipador"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ===== Blocos auxiliares ===== */

function WalletCard({
  icon,
  label,
  value,
  isLoading,
  delay = 0,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: number
  isLoading?: boolean
  delay?: number
  className?: string
}) {
  const { maskBRLExact: formatCurrency } = useMaskedCurrency()
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-1.5 rounded-2xl border px-3.5 py-3">
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
        <span className={className}>{icon}</span>
        {label}
      </span>
      {isLoading ? (
        <Bone delay={delay} className="h-6 w-20 sm:h-7 sm:w-24" />
      ) : (
        <span
          className={cn("text-base font-bold tabular-nums sm:text-lg", className)}
        >
          {formatCurrency(value)}
        </span>
      )}
    </div>
  )
}

function StatusBanner({
  icon,
  className,
  children,
}: {
  icon: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold",
        className,
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  action,
  className,
  children,
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4",
        className,
      )}
    >
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
    <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
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

function FieldBlock({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/20 flex flex-col items-center gap-1 rounded-2xl border px-3 py-3.5 text-center",
        className,
      )}
    >
      <span className="text-brand-mint not-dark:text-primary">{icon}</span>
      <span className="text-base font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

function EmptyBlock({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col items-center gap-3 rounded-2xl border py-12 text-center">
      <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
      </div>
    </div>
  )
}

function TermRow({ accepted, label }: { accepted: boolean; label: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border px-3.5 py-3",
        accepted
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-red-500/25 bg-red-500/5",
      )}
    >
      {accepted ? (
        <CheckCircle
          className="size-4.5 shrink-0 text-emerald-500"
          weight="fill"
        />
      ) : (
        <XCircle className="size-4.5 shrink-0 text-red-500" weight="fill" />
      )}
      <span className="text-sm font-medium">{label}</span>
      <span
        className={cn(
          "ml-auto text-xs font-semibold",
          accepted
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        {accepted ? "Aceito" : "Não aceito"}
      </span>
    </div>
  )
}
