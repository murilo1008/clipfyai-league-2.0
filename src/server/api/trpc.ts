/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { type UserRole } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@/server/db";
import { auth, currentUser } from "@clerk/nextjs/server";
import { resolveCsViewForRequest } from "@/server/cs-view/resolve";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

export const middleware = t.middleware;

/**
 * `auth()` valida o token da sessão localmente (sem rede). Já `currentUser()`
 * faz uma requisição HTTP à API do Clerk, e o middleware roda uma vez por
 * procedure — num batch com 9 queries seriam 9 chamadas ao Clerk.
 * Só use `privateProcedureWithUser` quando precisar do objeto completo do
 * usuário (ex.: e-mail).
 */
// Mesmo princípio do role abaixo: o id do ClipperProfile do usuário é buscado
// uma única vez por requisição, mesmo com várias procedures no batch.
const clipperProfileIdCache = new WeakMap<
  object,
  Map<string, Promise<string | null>>
>();

function getCachedClipperProfileId(ctx: { db: typeof db }, userId: string) {
  let byUser = clipperProfileIdCache.get(ctx);
  if (!byUser) {
    byUser = new Map();
    clipperProfileIdCache.set(ctx, byUser);
  }
  let profileId = byUser.get(userId);
  if (!profileId) {
    profileId = ctx.db.clipperProfile
      .findUnique({ where: { userId }, select: { id: true } })
      .then((profile) => profile?.id ?? null);
    byUser.set(userId, profileId);
  }
  return profileId;
}

// Customer Success: se houver uma seleção de cliente válida no cookie, o "usuário
// atual" passa a ser o cliente visualizado. Para todos os outros papéis (ou sem
// cookie) isto é um passthrough sem nenhuma query extra. Resolvido uma vez por
// requisição (memoizado pelo objeto Headers do contexto).
function resolveCsForRequest(ctx: { db: typeof db; headers: Headers }, actorId: string) {
  return resolveCsViewForRequest({ db: ctx.db, actorId, headers: ctx.headers });
}

const isAuth = middleware(async (opts) => {
  const { userId: actorUserId } = await auth();

  if (!actorUserId) {
    throw new Error("Unauthorized");
  }

  const view = await resolveCsForRequest(opts.ctx, actorUserId);
  const userId = view.effectiveUserId;

  const baseCtx = opts.ctx;
  return opts.next({
    ctx: {
      ...opts.ctx, // Propagar o contexto original (incluindo db)
      /** Id efetivo: o cliente visualizado (modo CS) ou o próprio usuário logado. */
      userId,
      /** Id de quem está realmente logado (igual a `userId` fora do modo CS). */
      actorUserId,
      csView: view.csView,
      csSelectionStale: view.stale,
      /** id do ClipperProfile do usuário (null se não tiver), 1 consulta por requisição. */
      getClipperProfileId: () => getCachedClipperProfileId(baseCtx, userId),
    },
  });
});

const isAuthWithUser = middleware(async (opts) => {
  const user = await currentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Mesma troca de usuário efetivo do `isAuth`; `user` continua sendo o objeto
  // Clerk de quem está logado (o CS, em modo de visualização).
  const view = await resolveCsForRequest(opts.ctx, user.id);

  return opts.next({
    ctx: {
      ...opts.ctx, // Propagar o contexto original (incluindo db)
      userId: view.effectiveUserId,
      actorUserId: user.id,
      user,
      csView: view.csView,
      csSelectionStale: view.stale,
    },
  });
});

// O contexto é criado uma vez por requisição HTTP e compartilhado pelas
// procedures do mesmo batch: o role é buscado no banco uma única vez.
const roleCache = new WeakMap<object, Map<string, Promise<UserRole | null>>>();

function getCachedUserRole(ctx: { db: typeof db }, userId: string) {
  let byUser = roleCache.get(ctx);
  if (!byUser) {
    byUser = new Map();
    roleCache.set(ctx, byUser);
  }
  let role = byUser.get(userId);
  if (!role) {
    role = ctx.db.user
      .findUnique({ where: { id: userId }, select: { role: true } })
      .then((dbUser) => dbUser?.role ?? null);
    byUser.set(userId, role);
  }
  return role;
}

const isAdmin = middleware(async (opts) => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const role = await getCachedUserRole(opts.ctx, userId);

  if (role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }

  return opts.next({
    ctx: {
      ...opts.ctx, // Propagar o contexto original (incluindo db)
      userId,
      userRole: role,
    },
  });
});

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

// Mesmo log de tempo, sem o atraso artificial de dev (procedures privadas
// nunca tiveram esse atraso).
const durationLogMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  console.log(`[TRPC] ${path} took ${Date.now() - start}ms to execute`);
  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);
export const privateProcedure = t.procedure
  .use(durationLogMiddleware)
  .use(isAuth);
/** Igual ao `privateProcedure`, mas busca o usuário completo no Clerk (rede). */
export const privateProcedureWithUser = t.procedure
  .use(durationLogMiddleware)
  .use(isAuthWithUser);
export const adminProcedure = t.procedure.use(timingMiddleware).use(isAdmin);

/**
 * Procedure restrita a usuários de Customer Success. Checa o papel de quem está
 * REALMENTE logado (`actorUserId`), e não o do cliente visualizado.
 */
export const csProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const role = await getCachedUserRole(ctx, ctx.actorUserId);

  if (role !== "CUSTOMER_SUCCESS") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito a usuários de Customer Success",
    });
  }

  return next({ ctx: { ...ctx, actorRole: role } });
});
