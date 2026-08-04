"use client"

import {
  ArrowSquareOut,
  Info,
  Plus,
  SealCheck,
  UsersThree,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"

import { EmptyState, formatNumber } from "../../competitions/[slug]/shared"
import { type ApplicationAccount } from "./shared"

/* ============================================================
   Tab "Minhas Contas"
   ============================================================ */

export function AccountsTab({
  accounts,
  onAddAccounts,
}: {
  accounts: ApplicationAccount[] | undefined
  onAddAccounts: () => void
}) {
  const hasAccounts = !!accounts && accounts.length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
            <UsersThree className="size-4.5" weight="fill" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold sm:text-base">Contas Cadastradas</p>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Contas que você está usando nesta competição
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="btn-gradient-auth h-9 w-fit cursor-pointer rounded-xl font-semibold"
          onClick={onAddAccounts}
        >
          <Plus className="size-4" weight="bold" />
          <span className="hidden sm:inline">Adicionar Contas</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      {/* Lista de contas */}
      {!hasAccounts ? (
        <EmptyState
          icon={<UsersThree className="size-6" weight="fill" />}
          title="Nenhuma conta cadastrada"
          subtitle="Adicione suas contas de redes sociais para começar a postar nesta competição"
          action={
            <Button
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              onClick={onAddAccounts}
            >
              <Plus className="size-4" weight="bold" />
              Adicionar Primeira Conta
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {accounts.map((account) => {
            const config = platformConfig[account.platform as PlatformKey]
            const PlatformIcon = config?.icon
            return (
              <div
                key={account.id}
                className="glass-card glass-card-hover flex items-start justify-between gap-3 rounded-3xl p-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12",
                      config?.bgColor ?? "bg-muted",
                    )}
                  >
                    {PlatformIcon && (
                      <PlatformIcon
                        className={cn("size-5 sm:size-6", config?.color)}
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold sm:text-lg">
                        {account.username}
                      </h3>
                      {account.isPrimary && (
                        <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A]">
                          Principal
                        </Badge>
                      )}
                      {account.isVerified && (
                        <Badge
                          variant="secondary"
                          className="gap-0.5 px-1.5 py-0 text-[10px]"
                        >
                          <SealCheck className="size-3" weight="fill" />
                          Verificado
                        </Badge>
                      )}
                    </div>

                    <p
                      className={cn(
                        "mb-2 text-xs font-medium sm:text-sm",
                        config?.color ?? "text-muted-foreground",
                      )}
                    >
                      {config?.label ?? account.platform}
                    </p>

                    {!!account.followers && (
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <UsersThree className="size-3" weight="fill" />
                        {formatNumber(account.followers)} seguidores
                      </p>
                    )}
                  </div>
                </div>

                {account.profileUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 shrink-0 cursor-pointer rounded-lg p-0"
                    asChild
                  >
                    <a
                      href={account.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir perfil ${account.username}`}
                    >
                      <ArrowSquareOut className="size-4" />
                    </a>
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* CTA adicionar mais contas */}
      {hasAccounts && (
        <div className="glass-card flex flex-col items-start justify-between gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex flex-1 items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Plus className="size-4.5" weight="bold" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                Quer adicionar mais contas?
              </p>
              <p className="text-muted-foreground text-xs">
                Você pode adicionar quantas contas quiser para esta competição
              </p>
            </div>
          </div>
          <Button
            className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            onClick={onAddAccounts}
          >
            <Plus className="size-4" weight="bold" />
            <span className="hidden sm:inline">Adicionar Mais Contas</span>
            <span className="sm:hidden">Adicionar</span>
          </Button>
        </div>
      )}

      {/* Dica */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400">
          <Info className="size-4" weight="fill" />
        </span>
        <div>
          <p className="mb-1 text-sm font-medium text-blue-500 dark:text-blue-400">
            Dica Importante
          </p>
          <p className="text-muted-foreground text-xs">
            Apenas posts das contas cadastradas aqui serão contabilizados nesta
            competição. Certifique-se de adicionar todas as contas que pretende
            usar.
          </p>
        </div>
      </div>
    </div>
  )
}
