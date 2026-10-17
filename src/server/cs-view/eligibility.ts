import type { CampaignStatus, Prisma, PrismaClient } from "@prisma/client";

/**
 * Regras de quais clientes um usuário CS pode visualizar.
 *
 * - "Cliente" é um `User` com `role = CLIENT` (as competições apontam para ele por
 *   `Campaign.clientId`).
 * - Só entram clientes com pelo menos uma competição ACTIVE ou COMPLETED. Competições
 *   ARCHIVED, DRAFT, SCHEDULED e PAUSED não contam. O status do ClientProfile é ignorado.
 * - A lista de acessos (`CsClientAccess`) restringe o conjunto; ZERO linhas = todos.
 */

export const CS_ROLE = "CUSTOMER_SUCCESS" as const;

export const VIEWABLE_CAMPAIGN_STATUSES = [
  "ACTIVE",
  "COMPLETED",
] as const satisfies readonly CampaignStatus[];

/** Converte as linhas de acesso em allowlist. Lista vazia ⇒ `null` ⇒ acesso a todos. */
export function allowedClientIdsFor(
  rows: ReadonlyArray<{ clientId: string }>,
): string[] | null {
  if (rows.length === 0) return null;
  return Array.from(new Set(rows.map((row) => row.clientId)));
}

export function viewableClientWhere(
  allowedIds: string[] | null,
  search?: string | null,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    role: "CLIENT",
    clientCampaigns: {
      some: { status: { in: [...VIEWABLE_CAMPAIGN_STATUSES] } },
    },
  };
  if (allowedIds) {
    where.id = { in: allowedIds };
  }
  const term = search?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      {
        clientProfile: {
          is: { company: { contains: term, mode: "insensitive" } },
        },
      },
    ];
  }
  return where;
}

export const viewableClientSelect = {
  id: true,
  name: true,
  email: true,
  imageUrl: true,
  clientProfile: { select: { company: true } },
} satisfies Prisma.UserSelect;

export type ViewableClient = Prisma.UserGetPayload<{
  select: typeof viewableClientSelect;
}>;

/**
 * Devolve o cliente se — e somente se — ele estiver na allowlist (quando houver) e
 * for elegível (CLIENT com competição ACTIVE/COMPLETED). Caso contrário, `null`.
 */
export async function findViewableClient(
  db: PrismaClient,
  params: { allowedIds: string[] | null; clientId: string },
): Promise<ViewableClient | null> {
  if (params.allowedIds && !params.allowedIds.includes(params.clientId)) {
    return null;
  }
  // A allowlist já foi conferida acima; a consulta restringe pelo id EXATO (um
  // `id: { in: allowedIds }` aqui faria o findFirst devolver outro cliente permitido).
  return db.user.findFirst({
    where: { ...viewableClientWhere(null), id: params.clientId },
    select: viewableClientSelect,
  });
}
