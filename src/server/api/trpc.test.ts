import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, currentUser } = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth, currentUser }));
vi.mock("@/server/db", () => ({ db: {} }));

/** Upstream: `isAuth`/`isAdmin` usam `auth()`; `currentUser()` só em procedures com usuário. */
function signIn(id: string | null) {
  auth.mockResolvedValue({ userId: id });
  currentUser.mockResolvedValue(id ? { id } : null);
}

import { CS_COOKIE_NAME } from "@/server/cs-view/cookie";
import {
  createCallerFactory,
  createTRPCRouter,
  csProcedure,
  privateProcedure,
} from "./trpc";

const router = createTRPCRouter({
  whoami: privateProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    actorUserId: ctx.actorUserId,
    clientId: ctx.csView?.client.id ?? null,
    stale: ctx.csSelectionStale,
  })),
  csOnly: csProcedure.query(({ ctx }) => ({
    actorUserId: ctx.actorUserId,
    actorRole: ctx.actorRole,
  })),
});
const createCaller = createCallerFactory(router);

const csUser = {
  id: "cs-1",
  name: "Ana",
  email: "ana@clipfy.ai",
  imageUrl: null,
  role: "CUSTOMER_SUCCESS",
  csClientAccess: [],
};
const clientRow = {
  id: "client-1",
  name: "Cliente",
  email: "c@x.com",
  imageUrl: null,
  clientProfile: null,
};

function setup(users: Record<string, unknown>, client: unknown = null) {
  const db = {
    user: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => users[where.id] ?? null,
      ),
      findFirst: vi.fn().mockResolvedValue(client),
    },
  };
  const caller = (cookie?: string) =>
    createCaller({
      db,
      headers: new Headers(cookie ? { cookie } : {}),
    } as never);
  return { db, caller };
}

const cookie = (actor: string, client: string) =>
  `${CS_COOKIE_NAME}=${actor}:${client}`;

describe("isAuth + Customer Success", () => {
  beforeEach(() => {
    auth.mockReset();
    currentUser.mockReset();
  });

  it("sem cookie: userId é o próprio usuário e nenhuma query extra roda", async () => {
    signIn("clipper-1");
    const { db, caller } = setup({});
    await expect(caller().whoami()).resolves.toEqual({
      userId: "clipper-1",
      actorUserId: "clipper-1",
      clientId: null,
      stale: false,
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("CS com cookie válido: userId vira o cliente, actorUserId continua o CS", async () => {
    signIn("cs-1");
    const { caller } = setup({ "cs-1": csUser }, clientRow);
    await expect(caller(cookie("cs-1", "client-1")).whoami()).resolves.toEqual({
      userId: "client-1",
      actorUserId: "cs-1",
      clientId: "client-1",
      stale: false,
    });
  });

  it("CS com cookie para cliente indisponível: stale e userId = CS", async () => {
    signIn("cs-1");
    const { caller } = setup({ "cs-1": csUser }, null);
    await expect(caller(cookie("cs-1", "client-1")).whoami()).resolves.toEqual({
      userId: "cs-1",
      actorUserId: "cs-1",
      clientId: null,
      stale: true,
    });
  });

  it("cookie forjado por quem não é CS não tem efeito", async () => {
    signIn("clipper-1");
    const { db, caller } = setup(
      { "clipper-1": { ...csUser, id: "clipper-1", role: "CLIPPER" } },
      clientRow,
    );
    await expect(
      caller(cookie("clipper-1", "client-1")).whoami(),
    ).resolves.toMatchObject({
      userId: "clipper-1",
      clientId: null,
      stale: false,
    });
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("csProcedure recusa quem não é CS", async () => {
    signIn("client-1");
    const { caller } = setup({ "client-1": { role: "CLIENT" } });
    await expect(caller().csOnly()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("csProcedure aceita o CS mesmo enquanto visualiza um cliente", async () => {
    signIn("cs-1");
    const { caller } = setup({ "cs-1": csUser }, clientRow);
    await expect(caller(cookie("cs-1", "client-1")).csOnly()).resolves.toEqual({
      actorUserId: "cs-1",
      actorRole: "CUSTOMER_SUCCESS",
    });
  });
});
