"use client"

import { api } from "@/trpc/react"

/**
 * Depois de aplicar/revogar advertências e punições: atualiza as filas e
 * históricos de advertência e os dados do clipador que os efeitos alteram
 * (status de banido, carteira, transações estornadas).
 */
export function useInvalidateDiscipline() {
  const utils = api.useUtils()
  return () => {
    void utils.clipperDiscipline.invalidate()
    void utils.clipper.getAll.invalidate()
    void utils.clipper.getById.invalidate()
    void utils.clipper.getStats.invalidate()
    void utils.clipper.getWallet.invalidate()
    void utils.clipper.getWalletStats.invalidate()
    void utils.clipper.getTransactions.invalidate()
  }
}
