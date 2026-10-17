import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import type { UserRole } from "@prisma/client";

import { db } from "@/server/db";

import { CS_COOKIE_NAME } from "./cookie";
import { resolveCsView, type CsViewInfo } from "./resolve";

export type Viewer = {
  /** Usuário realmente logado. `role` é `null` se não existir no banco. */
  actor: { id: string; role: UserRole | null };
  /** Usuário "efetivo": o cliente visualizado quando há seleção de CS válida. */
  effective: { id: string; role: UserRole | null };
  csView: CsViewInfo | null;
  stale: boolean;
};

/**
 * Equivalente, para Server Components e Route Handlers, do que `isAuth` faz no tRPC.
 * Memoizado por request via `cache()`.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const cookieStore = await cookies();
  const view = await resolveCsView({
    db,
    actorId: userId,
    cookieValue: cookieStore.get(CS_COOKIE_NAME)?.value ?? null,
  });

  let actorRole: UserRole | null = view.actorRole ?? null;
  if (view.actorRole === undefined) {
    const actor = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    actorRole = actor?.role ?? null;
  }

  return {
    actor: { id: userId, role: actorRole },
    effective: {
      id: view.effectiveUserId,
      role: view.csView ? "CLIENT" : actorRole,
    },
    csView: view.csView,
    stale: view.stale,
  };
});
