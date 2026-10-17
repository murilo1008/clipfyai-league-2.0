"use client";

import * as React from "react";
import { toast } from "sonner";

import { selectCsClient } from "@/server/cs-view/actions";
import { api } from "@/trpc/react";

/**
 * Estado de Customer Success a partir de `user.getCurrentUser` (React Query deduplica
 * a chamada com os demais componentes do shell).
 *
 * - `isCs`: quem está logado é um usuário CS (com ou sem cliente selecionado).
 * - `csView`: cliente visualizado + identidade real do CS, ou `null`.
 * - `stale`: o cookie aponta para um cliente que não está mais disponível.
 */
export function useCsView() {
  const { data: user, isLoading } = api.user.getCurrentUser.useQuery();
  const csView = user?.csView ?? null;
  const isCs = user?.role === "CUSTOMER_SUCCESS" || csView !== null;
  return {
    user,
    isLoading,
    isCs,
    csView,
    stale: user?.csSelectionStale ?? false,
  };
}

/**
 * Seleciona o cliente a visualizar (Server Action grava o cookie httpOnly) e recarrega
 * a aplicação em "/". A navegação completa é intencional: zera todo o cache do React
 * Query e qualquer estado de tela do cliente anterior de uma vez só.
 */
export function useSelectCsClient() {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const select = React.useCallback(async (clientId: string) => {
    setPendingId(clientId);
    try {
      const result = await selectCsClient(clientId);
      if (!result.ok) {
        toast.error(result.error);
        setPendingId(null);
        return false;
      }
      window.location.assign("/");
      return true;
    } catch (error) {
      console.error("Erro ao selecionar cliente (CS):", error);
      toast.error("Não foi possível selecionar o cliente. Tente novamente.");
      setPendingId(null);
      return false;
    }
  }, []);

  return { select, pendingId };
}
