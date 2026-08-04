"use client"

import * as React from "react"
import Link from "next/link"
import {
  CaretUpDown,
  Check,
  CheckCircle,
  Plus,
  Spinner,
  UsersThree,
  Warning,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { formatNumber } from "../../competitions/[slug]/shared"
import {
  nicheConfig,
  sortedNiches,
  type AccountNiche,
  type ApplicationAccount,
  type SocialAccount,
  type SocialPlatformKey,
} from "./shared"

/* ============================================================
   Dialog "Adicionar Contas à Competição"
   ============================================================ */

export function AddAccountsDialog({
  open,
  onOpenChange,
  applicationId,
  allSocialAccounts,
  applicationAccounts,
  onCreateAccount,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  allSocialAccounts: SocialAccount[] | undefined
  applicationAccounts: ApplicationAccount[] | undefined
  /** Fecha este dialog e abre o de criar nova conta. */
  onCreateAccount: () => void
  /** Refetch das contas da aplicação após adicionar. */
  onAdded: () => void
}) {
  const [selectedAccountsToAdd, setSelectedAccountsToAdd] = React.useState<
    string[]
  >([])

  const addAccountsMutation = api.clipper.addAccountsToApplication.useMutation({
    onSuccess: () => {
      toast.success("Contas adicionadas com sucesso!")
      onAdded()
      onOpenChange(false)
      setSelectedAccountsToAdd([])
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar contas")
    },
  })

  /* Contas ativas ainda não vinculadas a esta competição */
  const availableAccounts = React.useMemo(
    () =>
      (allSocialAccounts ?? [])
        .filter((account) => account.isActive !== false)
        .filter(
          (account) =>
            !applicationAccounts?.some((appAcc) => appAcc.id === account.id),
        ),
    [allSocialAccounts, applicationAccounts],
  )

  const hasAnyAccount = (allSocialAccounts ?? []).length > 0

  const handleSubmit = () => {
    if (selectedAccountsToAdd.length === 0) {
      toast.error("Selecione ao menos uma conta")
      return
    }
    addAccountsMutation.mutate({
      applicationId,
      accountIds: selectedAccountsToAdd,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <UsersThree className="text-primary size-5 sm:size-6" weight="fill" />
            Adicionar Contas à Competição
          </DialogTitle>
          <DialogDescription className="text-sm">
            Selecione as contas que deseja adicionar a esta competição
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Aviso */}
          <div className="flex items-start gap-3 rounded-2xl border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-4">
            <Warning
              className="mt-0.5 size-5 shrink-0 text-amber-500"
              weight="fill"
            />
            <div>
              <p className="mb-1 text-sm font-semibold text-amber-500">
                ⚠️ ATENÇÃO
              </p>
              <p className="text-muted-foreground text-xs">
                Apenas posts das contas selecionadas serão válidos para esta
                competição. Certifique-se de adicionar todas as contas que
                pretende usar.
              </p>
            </div>
          </div>

          {/* Contas disponíveis */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-semibold">
              Escolha as Contas para Adicionar
            </Label>

            {!hasAnyAccount ? (
              <div className="bg-muted/30 flex flex-col items-center gap-3 rounded-2xl py-8 text-center">
                <UsersThree className="text-muted-foreground size-12" />
                <div>
                  <p className="text-sm font-medium">Nenhuma conta cadastrada</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Você precisa cadastrar suas contas de redes sociais primeiro
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
                    onClick={onCreateAccount}
                  >
                    <Plus className="size-4" weight="bold" />
                    Criar Nova Conta
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer rounded-xl"
                    asChild
                  >
                    <Link href="/settings/manage-accounts">Gerenciar</Link>
                  </Button>
                </div>
              </div>
            ) : availableAccounts.length === 0 ? (
              <div className="bg-muted/30 rounded-2xl p-4 text-center">
                <p className="text-muted-foreground text-xs">
                  Todas as suas contas ativas já estão vinculadas a esta
                  competição.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {availableAccounts.map((account) => {
                  const config = platformConfig[account.platform as PlatformKey]
                  const PlatformIcon = config?.icon
                  const isSelected = selectedAccountsToAdd.includes(account.id)

                  return (
                    <button
                      key={account.id}
                      type="button"
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left transition-all sm:p-4",
                        isSelected
                          ? "border-primary bg-primary/5 ring-primary ring-2"
                          : "border-border hover:border-primary/50 hover:bg-muted/50",
                      )}
                      onClick={() =>
                        setSelectedAccountsToAdd((prev) =>
                          prev.includes(account.id)
                            ? prev.filter((id) => id !== account.id)
                            : [...prev, account.id],
                        )
                      }
                    >
                      <Checkbox
                        checked={isSelected}
                        className="pointer-events-none"
                      />
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          config?.bgColor ?? "bg-muted",
                        )}
                      >
                        {PlatformIcon && (
                          <PlatformIcon
                            className={cn("size-5", config?.color)}
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 flex items-center gap-2">
                          <span className="truncate font-semibold">
                            {account.username}
                          </span>
                          {account.isPrimary && (
                            <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A]">
                              Principal
                            </Badge>
                          )}
                        </span>
                        <span
                          className={cn(
                            "block text-xs",
                            config?.color ?? "text-muted-foreground",
                          )}
                        >
                          {config?.label ?? account.platform}
                        </span>
                      </span>
                      {!!account.followers && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <UsersThree className="size-3" weight="fill" />
                          {formatNumber(account.followers)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resumo */}
          {selectedAccountsToAdd.length > 0 && (
            <div className="rounded-2xl border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-500/10 to-green-500/10 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-500 dark:text-emerald-400">
                <CheckCircle className="size-4" weight="fill" />
                {selectedAccountsToAdd.length} conta(s) selecionada(s)
              </p>
              <p className="text-muted-foreground text-xs">
                Posts dessas contas serão contabilizados nesta competição
              </p>
            </div>
          )}

          {/* Criar nova conta */}
          <Separator />
          <div className="bg-muted/40 flex flex-col items-start justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium">
                Não encontrou sua conta?
              </p>
              <p className="text-muted-foreground text-xs">
                Crie uma nova conta agora mesmo
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
                onClick={onCreateAccount}
              >
                <Plus className="size-4" weight="bold" />
                Criar Conta
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer rounded-xl"
                asChild
              >
                <Link href="/settings/manage-accounts" target="_blank">
                  Gerenciar
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="cursor-pointer rounded-xl"
            onClick={() => {
              onOpenChange(false)
              setSelectedAccountsToAdd([])
            }}
          >
            Cancelar
          </Button>
          <Button
            className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            onClick={handleSubmit}
            disabled={
              selectedAccountsToAdd.length === 0 || addAccountsMutation.isPending
            }
          >
            {addAccountsMutation.isPending ? (
              <>
                <Spinner className="size-4 animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <Plus className="size-4" weight="bold" />
                Adicionar{" "}
                {selectedAccountsToAdd.length > 0
                  ? `(${selectedAccountsToAdd.length})`
                  : "Contas"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================
   Dialog "Adicionar Nova Conta"
   ============================================================ */

const PLATFORM_OPTIONS: SocialPlatformKey[] = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "KWAI",
  "FACEBOOK",
]

const EMPTY_ACCOUNT = {
  platform: "INSTAGRAM" as SocialPlatformKey,
  username: "",
  profileUrl: "",
  niche: "",
}

export function CreateAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado após criar (refetch das contas + reabrir o dialog de adicionar). */
  onCreated: () => void
}) {
  const [newAccountData, setNewAccountData] = React.useState(EMPTY_ACCOUNT)
  const [createNicheOpen, setCreateNicheOpen] = React.useState(false)

  const createAccountMutation = api.clipper.addSocialAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta criada com sucesso!")
      onOpenChange(false)
      setNewAccountData(EMPTY_ACCOUNT)
      onCreated()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar conta")
    },
  })

  const handleCreate = () => {
    if (!newAccountData.username.trim()) {
      toast.error("Digite o username da conta")
      return
    }
    if (!newAccountData.niche) {
      toast.error("Selecione o nicho da conta")
      return
    }
    createAccountMutation.mutate({
      platform: newAccountData.platform,
      username: newAccountData.username,
      profileUrl: newAccountData.profileUrl || undefined,
      niche: newAccountData.niche as AccountNiche,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Adicionar Nova Conta
          </DialogTitle>
          <DialogDescription>
            Adicione uma conta de rede social ao seu perfil
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Plataforma */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-account-platform">Plataforma</Label>
            <Select
              value={newAccountData.platform}
              onValueChange={(value) =>
                setNewAccountData({
                  ...newAccountData,
                  platform: value as SocialPlatformKey,
                })
              }
            >
              <SelectTrigger
                id="new-account-platform"
                className="h-10 w-full cursor-pointer rounded-xl"
              >
                <SelectValue placeholder="Selecione a plataforma" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PLATFORM_OPTIONS.map((platform) => {
                  const config = platformConfig[platform]
                  const PlatformIcon = config.icon
                  return (
                    <SelectItem key={platform} value={platform}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon className={cn("size-4", config.color)} />
                        {config.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-account-username">Nome de Usuário</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                @
              </span>
              <Input
                id="new-account-username"
                placeholder="seu_usuario"
                value={newAccountData.username}
                onChange={(event) => {
                  const cleaned = event.target.value
                    .replace(/@/g, "")
                    .replace(/\s/g, "")
                  setNewAccountData({ ...newAccountData, username: cleaned })
                }}
                className="h-10 rounded-xl pl-7"
                disabled={createAccountMutation.isPending}
              />
            </div>
          </div>

          {/* Nicho */}
          <div className="flex flex-col gap-1.5">
            <Label>Nicho da Conta</Label>
            <Popover open={createNicheOpen} onOpenChange={setCreateNicheOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={createNicheOpen}
                  className="h-10 w-full cursor-pointer justify-between rounded-xl font-normal"
                >
                  {newAccountData.niche ? (
                    <span className="flex items-center gap-2">
                      <span>{nicheConfig[newAccountData.niche]?.emoji}</span>
                      <span>{nicheConfig[newAccountData.niche]?.label}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Selecione o nicho
                    </span>
                  )}
                  <CaretUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] rounded-xl p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Buscar nicho..." className="h-10" />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>Nenhum nicho encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sortedNiches.map(([key, { label, emoji }]) => (
                        <CommandItem
                          key={key}
                          value={label}
                          onSelect={() => {
                            setNewAccountData({ ...newAccountData, niche: key })
                            setCreateNicheOpen(false)
                          }}
                          className="cursor-pointer"
                        >
                          <span className="flex flex-1 items-center gap-2.5">
                            <span className="text-sm">{emoji}</span>
                            <span className="text-sm font-medium">{label}</span>
                          </span>
                          {newAccountData.niche === key && (
                            <Check className="text-primary size-4 shrink-0" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer rounded-xl"
              onClick={() => {
                onOpenChange(false)
                setNewAccountData(EMPTY_ACCOUNT)
              }}
              disabled={createAccountMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="btn-gradient-auth flex-1 cursor-pointer rounded-xl font-semibold"
              onClick={handleCreate}
              disabled={
                !newAccountData.username.trim() ||
                !newAccountData.niche ||
                createAccountMutation.isPending
              }
            >
              {createAccountMutation.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="size-4" weight="bold" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
