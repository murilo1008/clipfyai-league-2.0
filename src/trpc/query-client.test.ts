import { createTRPCReact, getQueryKey } from "@trpc/react-query";
import { describe, expect, it } from "vitest";

import type { AppRouter } from "@/server/api/root";

import { createQueryClient } from "./query-client";

const api = createTRPCReact<AppRouter>();

describe("defaults do query client", () => {
  it("mantém getCurrentUser fresco por 5 minutos na chave real do tRPC", () => {
    const queryClient = createQueryClient();
    // Mesma chave que api.user.getCurrentUser.useQuery() e o prefetch do RSC usam
    const queryKey = getQueryKey(api.user.getCurrentUser, undefined, "query");

    expect(queryKey).toEqual([["user", "getCurrentUser"], { type: "query" }]);
    expect(queryClient.defaultQueryOptions({ queryKey }).staleTime).toBe(
      5 * 60 * 1000,
    );
  });

  it("não altera o staleTime das outras queries", () => {
    const queryClient = createQueryClient();
    const queryKey = getQueryKey(
      api.user.getVerificationStatus,
      undefined,
      "query",
    );

    expect(queryClient.defaultQueryOptions({ queryKey }).staleTime).toBe(
      60 * 1000,
    );
  });
});
