import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, currentUser } = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth, currentUser, clerkClient: vi.fn() }));
vi.mock("@/server/db", () => ({ db: {} }));

/** Upstream: `isAuth`/`isAdmin` usam `auth()`; `currentUser()` só em procedures com usuário. */
function signIn(id: string | null) {
  auth.mockResolvedValue({ userId: id });
  currentUser.mockResolvedValue(id ? { id } : null);
}

import { CS_COOKIE_NAME } from "@/server/cs-view/cookie";
import { userRouter } from "./user";

const csUser = {
  id: "cs-1",
  name: "Ana CS",
  email: "ana@clipfy.ai",
  imageUrl: null,
  role: "CUSTOMER_SUCCESS",
  csClientAccess: [],
  clipperProfile: null,
};
const clientUser = {
  id: "client-1",
  name: "Cliente X",
  email: "x@cliente.com",
  imageUrl: null,
  role: "CLIENT",
  clientProfile: { company: "Empresa X" },
  clipperProfile: null,
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
    userRouter.createCaller({
      db,
      headers: new Headers(cookie ? { cookie } : {}),
    } as never);
  return { db, caller };
}

describe("user.getCurrentUser com Customer Success", () => {
  beforeEach(() => {
    auth.mockReset();
    currentUser.mockReset();
  });

  it("deslogado → null", async () => {
    signIn(null);
    const { caller } = setup({});
    await expect(caller().getCurrentUser()).resolves.toBeNull();
  });

  it("CS sem seleção → o próprio CS, role CUSTOMER_SUCCESS, csView null", async () => {
    signIn("cs-1");
    const { caller } = setup({ "cs-1": csUser });
    await expect(caller().getCurrentUser()).resolves.toMatchObject({
      id: "cs-1",
      role: "CUSTOMER_SUCCESS",
      csView: null,
      csSelectionStale: false,
    });
  });

  it("CS visualizando um cliente → devolve o CLIENTE com csView do ator", async () => {
    signIn("cs-1");
    const { caller } = setup(
      { "cs-1": csUser, "client-1": clientUser },
      clientUser,
    );
    const result = await caller(
      `${CS_COOKIE_NAME}=cs-1:client-1`,
    ).getCurrentUser();
    expect(result).toMatchObject({
      id: "client-1",
      role: "CLIENT",
      csSelectionStale: false,
      csView: {
        actor: { id: "cs-1", email: "ana@clipfy.ai" },
        client: { id: "client-1", company: "Empresa X" },
      },
    });
  });

  it("cookie obsoleto → o próprio CS com csSelectionStale = true", async () => {
    signIn("cs-1");
    const { caller } = setup({ "cs-1": csUser }, null);
    await expect(
      caller(`${CS_COOKIE_NAME}=cs-1:client-1`).getCurrentUser(),
    ).resolves.toMatchObject({
      id: "cs-1",
      csView: null,
      csSelectionStale: true,
    });
  });

  it("outros papéis não são afetados por cookie alheio", async () => {
    signIn("clipper-1");
    const clipper = {
      id: "clipper-1",
      role: "CLIPPER",
      email: "c@c.com",
      clipperProfile: { id: "cp" },
    };
    const { db, caller } = setup({ "clipper-1": clipper });
    await expect(
      caller(`${CS_COOKIE_NAME}=cs-1:client-1`).getCurrentUser(),
    ).resolves.toMatchObject({
      id: "clipper-1",
      role: "CLIPPER",
      csView: null,
    });
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
});
