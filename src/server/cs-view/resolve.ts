import type { PrismaClient, UserRole } from "@prisma/client";

import { parseCsCookie, parseCsCookieValue } from "./cookie";
import {
  CS_ROLE,
  allowedClientIdsFor,
  findViewableClient,
} from "./eligibility";

export type CsViewInfo = {
  /** Quem está logado de verdade (o usuário CS). */
  actor: {
    id: string;
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
  /** O cliente cuja conta está sendo visualizada/operada. */
  client: {
    id: string;
    name: string | null;
    email: string;
    imageUrl: string | null;
    company: string | null;
  };
};

export type ResolvedCsView = {
  /** Id que as procedures/páginas devem usar como "usuário atual". */
  effectiveUserId: string;
  csView: CsViewInfo | null;
  /**
   * `true` quando o cookie pertence a este ator, o ator é CS, mas o cliente deixou de
   * ser válido (acesso revogado, cliente rebaixado/apagado, sem competição elegível).
   * A UI usa isso para limpar o cookie e voltar à tela de seleção.
   */
  stale: boolean;
  /** Papel do ator quando já foi carregado do banco (evita uma query extra no RSC). */
  actorRole?: UserRole;
};

type ResolveParams = {
  db: PrismaClient;
  actorId: string;
  /** Header `Cookie` completo (tRPC) … */
  cookieHeader?: string | null;
  /** … ou só o valor do cookie (RSC via `cookies()`). */
  cookieValue?: string | null;
};

/**
 * Único ponto de verdade sobre "o CS está visualizando qual cliente?".
 *
 * Caminho rápido: sem cookie, cookie inválido ou cookie de outro usuário ⇒ passthrough
 * SEM nenhuma query. Clippers, clientes e admins não pagam nada por esta feature.
 */
export async function resolveCsView(
  params: ResolveParams,
): Promise<ResolvedCsView> {
  const { db, actorId } = params;
  const passthrough: ResolvedCsView = {
    effectiveUserId: actorId,
    csView: null,
    stale: false,
  };

  const parsed =
    params.cookieValue !== undefined
      ? parseCsCookieValue(params.cookieValue)
      : parseCsCookie(params.cookieHeader);
  if (!parsed || parsed.actorId !== actorId) return passthrough;

  const actor = await db.user.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      role: true,
      csClientAccess: { select: { clientId: true } },
    },
  });
  if (!actor) return passthrough;
  if (actor.role !== CS_ROLE) {
    return { ...passthrough, actorRole: actor.role };
  }

  const client = await findViewableClient(db, {
    allowedIds: allowedClientIdsFor(actor.csClientAccess),
    clientId: parsed.clientId,
  });
  if (!client) {
    return { ...passthrough, stale: true, actorRole: actor.role };
  }

  return {
    effectiveUserId: client.id,
    csView: {
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        imageUrl: actor.imageUrl,
      },
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        imageUrl: client.imageUrl,
        company: client.clientProfile?.company ?? null,
      },
    },
    stale: false,
    actorRole: actor.role,
  };
}

const requestCache = new WeakMap<
  Headers,
  { actorId: string; promise: Promise<ResolvedCsView> }
>();

/**
 * Versão memoizada por request HTTP. O objeto `Headers` do contexto tRPC é o mesmo para
 * todas as procedures de um batch, então um batch com N procedures resolve uma vez só.
 */
export function resolveCsViewForRequest(params: {
  db: PrismaClient;
  actorId: string;
  headers: Headers | null | undefined;
}): Promise<ResolvedCsView> {
  const { db, actorId, headers } = params;
  if (!headers || typeof headers.get !== "function") {
    return resolveCsView({ db, actorId, cookieHeader: null });
  }
  const cached = requestCache.get(headers);
  if (cached && cached.actorId === actorId) return cached.promise;
  const promise = resolveCsView({
    db,
    actorId,
    cookieHeader: headers.get("cookie"),
  });
  requestCache.set(headers, { actorId, promise });
  return promise;
}
