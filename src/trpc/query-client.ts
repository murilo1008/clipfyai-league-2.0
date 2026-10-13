import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

/**
 * Prefixo da chave do tRPC para `user.getCurrentUser` (a chave completa é
 * `[["user", "getCurrentUser"], { type: "query" }]`; o casamento é parcial).
 */
export const CURRENT_USER_QUERY_KEY = [["user", "getCurrentUser"]];

export const createQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
        // Voltar para a aba refazia de uma vez todas as queries montadas
        // (sidebar, topbar e página). Mutations invalidam o que mudam e o
        // polling cobre os dados que precisam ficar ao vivo; queries que
        // precisam disso passam `refetchOnWindowFocus: true` explicitamente.
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });

  // getCurrentUser é lido pelo guard, sidebar, topbar e várias páginas e
  // quase nunca muda: com o staleTime padrão ele era refeito a cada
  // navegação. O perfil invalida a query ao salvar, e o guard do dashboard
  // reconfirma com o servidor antes de redirecionar por status.
  queryClient.setQueryDefaults(CURRENT_USER_QUERY_KEY, {
    staleTime: 5 * 60 * 1000,
  });

  return queryClient;
};
