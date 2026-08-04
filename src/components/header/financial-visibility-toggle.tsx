"use client"

import { Eye, EyeSlash, Wallet } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useFinancialVisibility,
  useMaskedCurrency,
} from "@/contexts/financial-visibility-context"
import { api } from "@/trpc/react"

/**
 * Alterna a exibição dos valores financeiros (R$) em toda a plataforma.
 * Como no original, só aparece para ADMIN e CLIPPER — e, para CLIPPER,
 * exibe também o saldo da carteira num chip glass ao lado do olhinho.
 */
export function FinancialVisibilityToggle() {
  const { isVisible, toggleVisibility } = useFinancialVisibility()
  const { maskBRL } = useMaskedCurrency()
  const { data: user } = api.user.getCurrentUser.useQuery()

  const clipperProfileId =
    user?.role === "CLIPPER" ? user.clipperProfile?.id : undefined
  const { data: wallet, isLoading: isLoadingWallet } =
    api.clipper.getWallet.useQuery(
      { clipperProfileId: clipperProfileId ?? "" },
      { enabled: !!clipperProfileId },
    )

  if (user?.role !== "ADMIN" && user?.role !== "CLIPPER") return null

  return (
    <div className="flex items-center gap-1.5">
      {/* Chip do saldo — só para CLIPPER, escondido em telas muito estreitas */}
      {user.role === "CLIPPER" &&
        (clipperProfileId && isLoadingWallet ? (
          <div className="skeleton-bone hidden h-8 w-24 rounded-lg sm:block" />
        ) : wallet ? (
          <div className="border-brand-mint/25 bg-brand-mint/8 not-dark:border-primary/25 not-dark:bg-primary/8 hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 backdrop-blur-sm sm:flex">
            <Wallet
              weight="fill"
              className="text-brand-mint not-dark:text-primary size-3.5 shrink-0"
            />
            <span className="text-xs font-semibold tabular-nums whitespace-nowrap">
              {maskBRL(wallet.balance)}
            </span>
          </div>
        ) : null)}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVisibility}
            aria-label={
              isVisible
                ? "Ocultar valores financeiros"
                : "Mostrar valores financeiros"
            }
            className="size-8 cursor-pointer rounded-lg"
          >
            {isVisible ? (
              <Eye className="size-4" />
            ) : (
              <EyeSlash className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isVisible ? "Ocultar valores (R$)" : "Mostrar valores (R$)"}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
