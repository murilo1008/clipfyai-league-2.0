"use server";

import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { env } from "@/env";
import { db } from "@/server/db";

import {
  CS_COOKIE_NAME,
  csCookieOptions,
  isValidCsId,
  serializeCsCookie,
} from "./cookie";
import {
  CS_ROLE,
  allowedClientIdsFor,
  findViewableClient,
} from "./eligibility";

export type SelectCsClientResult =
  | { ok: true; client: { id: string; name: string | null } }
  | { ok: false; error: string };

/**
 * Grava a seleção de cliente do usuário CS num cookie httpOnly.
 *
 * É uma Server Action (e não uma mutation tRPC) porque o cliente tRPC usa
 * `httpBatchStreamLink`: os headers da resposta já foram enviados quando a procedure
 * roda, então `Set-Cookie` lá não é confiável.
 */
export async function selectCsClient(
  clientId: string,
): Promise<SelectCsClientResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Você precisa estar autenticado." };
  if (!isValidCsId(clientId)) {
    return { ok: false, error: "Cliente inválido." };
  }

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, csClientAccess: { select: { clientId: true } } },
  });
  if (!actor || actor.role !== CS_ROLE) {
    return {
      ok: false,
      error: "Apenas usuários de Customer Success podem selecionar clientes.",
    };
  }

  const client = await findViewableClient(db, {
    allowedIds: allowedClientIdsFor(actor.csClientAccess),
    clientId,
  });
  if (!client) {
    return {
      ok: false,
      error:
        "Cliente indisponível. Ele pode ter sido removido do seu acesso ou não ter competições ativas ou concluídas.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    CS_COOKIE_NAME,
    serializeCsCookie({ actorId: userId, clientId: client.id }),
    csCookieOptions(env.NODE_ENV === "production"),
  );

  try {
    await db.auditLog.create({
      data: {
        userId,
        action: "LOGIN",
        entityType: "CsClientView",
        entityId: client.id,
        metadata: { clientName: client.name, clientEmail: client.email },
      },
    });
  } catch (error) {
    // Auditoria nunca deve impedir o CS de trabalhar.
    console.error("Falha ao registrar auditoria de visualização de CS:", error);
  }

  return { ok: true, client: { id: client.id, name: client.name } };
}

/** Remove a seleção atual (volta para a tela de escolha de cliente). */
export async function clearCsClient(): Promise<{ ok: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(CS_COOKIE_NAME);
  return { ok: true };
}
