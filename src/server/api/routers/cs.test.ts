import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, currentUser, clerkClient } = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth, currentUser, clerkClient }));
vi.mock("@/server/db", () => ({ db: {} }));

/** Upstream: `isAuth`/`isAdmin` usam `auth()`; `currentUser()` só em procedures com usuário. */
function signIn(id: string | null) {
  auth.mockResolvedValue({ userId: id });
  currentUser.mockResolvedValue(id ? { id } : null);
}

import { csRouter } from "./cs";

type Users = Record<string, unknown>;

function makeDb(users: Users) {
  const db = {
    user: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => users[where.id] ?? null,
      ),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    csClientAccess: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction:
      vi.fn<(fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(),
  };
  db.$transaction.mockImplementation((fn) => fn(db));
  return db;
}

function callerFor(db: unknown) {
  return csRouter.createCaller({ db, headers: new Headers() } as never);
}

const admin = { id: "admin-1", role: "ADMIN" };
const cs = {
  id: "cs-1",
  name: "Ana CS",
  email: "ana@clipfy.ai",
  imageUrl: null,
  role: "CUSTOMER_SUCCESS",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  csClientAccess: [
    {
      clientId: "old-client",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      client: {
        id: "old-client",
        name: "Antigo",
        email: "old@cliente.com",
        imageUrl: null,
        clientProfile: { company: "Antiga Ltda" },
      },
    },
  ],
};

const clerkUsers = {
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  clerkClient.mockResolvedValue({ users: clerkUsers });
});

describe("cs.view.clients", () => {
  it("aplica allowlist + filtro de competições ACTIVE/COMPLETED e resume contagens", async () => {
    signIn("cs-1");
    const db = makeDb({ "cs-1": cs });
    db.csClientAccess.findMany.mockResolvedValue([{ clientId: "c1" }]);
    db.user.findMany.mockResolvedValue([
      {
        id: "c1",
        name: "Cliente 1",
        email: "c1@x.com",
        imageUrl: null,
        clientProfile: { company: "Empresa 1" },
        clientCampaigns: [
          { status: "ACTIVE" },
          { status: "COMPLETED" },
          { status: "ACTIVE" },
        ],
      },
    ]);

    const result = await callerFor(db).view.clients({ search: "emp" });

    expect(result).toEqual([
      {
        id: "c1",
        name: "Cliente 1",
        email: "c1@x.com",
        imageUrl: null,
        company: "Empresa 1",
        activeCampaigns: 2,
        completedCampaigns: 1,
        eligibleCampaigns: 3,
      },
    ]);
    const where = db.user.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      role: "CLIENT",
      id: { in: ["c1"] },
      clientCampaigns: { some: { status: { in: ["ACTIVE", "COMPLETED"] } } },
    });
    expect(where.OR).toHaveLength(3);
    // Usa o ator (CS), não o usuário efetivo, para carregar a allowlist.
    expect(db.csClientAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { csUserId: "cs-1" } }),
    );
  });

  it("sem linhas de acesso não restringe por id", async () => {
    signIn("cs-1");
    const db = makeDb({ "cs-1": cs });
    await callerFor(db).view.clients();
    const where = db.user.findMany.mock.calls[0]?.[0]?.where;
    expect(where.id).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it("recusa quem não é CS", async () => {
    signIn("client-1");
    const db = makeDb({ "client-1": { role: "CLIENT" } });
    await expect(callerFor(db).view.clients()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("cs.admin", () => {
  it("bloqueia quem não é ADMIN", async () => {
    signIn("cs-1");
    const db = makeDb({ "cs-1": cs });
    await expect(callerFor(db).admin.list()).rejects.toThrow(/Forbidden/);
  });

  it("list resume acessos (allClients quando não há linhas)", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin });
    db.user.findMany.mockResolvedValue([
      cs,
      { ...cs, id: "cs-2", csClientAccess: [] },
    ]);
    const result = await callerFor(db).admin.list();
    expect(result[0]).toMatchObject({
      id: "cs-1",
      allClients: false,
      clients: [{ id: "old-client", company: "Antiga Ltda" }],
    });
    expect(result[1]).toMatchObject({
      id: "cs-2",
      allClients: true,
      clients: [],
    });
  });

  it("create valida ids de clientes antes de tocar no Clerk", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin });
    db.user.count.mockResolvedValue(1); // só 1 dos 2 ids é CLIENT
    await expect(
      callerFor(db).admin.create({
        name: "Novo CS",
        email: "novo@clipfy.ai",
        password: "senhaforte123",
        clientIds: ["c1", "c2"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(clerkUsers.createUser).not.toHaveBeenCalled();
  });

  it("create: Clerk → User + acessos + auditoria na mesma transação", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin });
    db.user.count.mockResolvedValue(2);
    db.user.create.mockResolvedValue({ id: "clerk-new" });
    clerkUsers.createUser.mockResolvedValue({ id: "clerk-new" });

    const result = await callerFor(db).admin.create({
      name: "Novo CS",
      email: "Novo@Clipfy.ai",
      password: "senhaforte123",
      clientIds: ["c1", "c2", "c1"],
    });

    expect(result).toEqual({ success: true, id: "clerk-new" });
    expect(clerkUsers.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: ["novo@clipfy.ai"],
        publicMetadata: { role: "CUSTOMER_SUCCESS" },
      }),
    );
    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "clerk-new",
        email: "novo@clipfy.ai",
        role: "CUSTOMER_SUCCESS",
        onboardingCompleted: true,
      }),
    });
    expect(db.csClientAccess.createMany).toHaveBeenCalledWith({
      data: [
        { csUserId: "clerk-new", clientId: "c1", grantedBy: "admin-1" },
        { csUserId: "clerk-new", clientId: "c2", grantedBy: "admin-1" },
      ],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "admin-1",
        action: "CREATE",
        entityType: "CsUser",
        entityId: "clerk-new",
      }),
    });
    expect(clerkUsers.deleteUser).not.toHaveBeenCalled();
  });

  it("create desfaz a conta do Clerk se o banco falhar", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin });
    clerkUsers.createUser.mockResolvedValue({ id: "clerk-new" });
    db.$transaction.mockRejectedValue(new Error("boom"));

    await expect(
      callerFor(db).admin.create({
        name: "Novo CS",
        email: "novo@clipfy.ai",
        password: "senhaforte123",
        clientIds: [],
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(clerkUsers.deleteUser).toHaveBeenCalledWith("clerk-new");
  });

  it("create recusa e-mail já usado", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin });
    db.user.findFirst.mockResolvedValue({ id: "someone" });
    await expect(
      callerFor(db).admin.create({
        name: "Novo CS",
        email: "novo@clipfy.ai",
        password: "senhaforte123",
        clientIds: [],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(clerkUsers.createUser).not.toHaveBeenCalled();
  });

  it("update substitui a lista de clientes e registra antes/depois", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin, "cs-1": cs });
    db.user.count.mockResolvedValue(1);

    await callerFor(db).admin.update({
      id: "cs-1",
      name: "Ana Souza",
      clientIds: ["new-client"],
    });

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "cs-1" },
      data: { name: "Ana Souza" },
    });
    expect(db.csClientAccess.deleteMany).toHaveBeenCalledWith({
      where: { csUserId: "cs-1" },
    });
    expect(db.csClientAccess.createMany).toHaveBeenCalledWith({
      data: [
        { csUserId: "cs-1", clientId: "new-client", grantedBy: "admin-1" },
      ],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE",
        entityType: "CsUser",
        changes: expect.objectContaining({
          before: { name: "Ana CS", clientIds: ["old-client"] },
          after: { name: "Ana Souza", clientIds: ["new-client"] },
        }),
      }),
    });
    expect(clerkUsers.updateUser).not.toHaveBeenCalled();
  });

  it("update com lista vazia libera todos (só deleteMany)", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin, "cs-1": cs });
    await callerFor(db).admin.update({ id: "cs-1", clientIds: [] });
    expect(db.csClientAccess.deleteMany).toHaveBeenCalled();
    expect(db.csClientAccess.createMany).not.toHaveBeenCalled();
  });

  it("update sem clientIds não mexe nos acessos; senha vai para o Clerk", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin, "cs-1": cs });
    await callerFor(db).admin.update({ id: "cs-1", password: "novasenha123" });
    expect(clerkUsers.updateUser).toHaveBeenCalledWith("cs-1", {
      password: "novasenha123",
    });
    expect(db.csClientAccess.deleteMany).not.toHaveBeenCalled();
  });

  it("update/delete recusam alvo que não é CS", async () => {
    signIn("admin-1");
    const db = makeDb({
      "admin-1": admin,
      "client-1": { ...cs, id: "client-1", role: "CLIENT" },
    });
    await expect(
      callerFor(db).admin.update({ id: "client-1", name: "x" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      callerFor(db).admin.delete({ id: "client-1" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("delete remove no banco e no Clerk e audita", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin, "cs-1": cs });
    await expect(callerFor(db).admin.delete({ id: "cs-1" })).resolves.toEqual({
      success: true,
    });
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: "cs-1" } });
    expect(clerkUsers.deleteUser).toHaveBeenCalledWith("cs-1");
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE",
        entityType: "CsUser",
        entityId: "cs-1",
      }),
    });
  });

  it("delete segue mesmo se o Clerk falhar (conta já saiu do banco)", async () => {
    signIn("admin-1");
    const db = makeDb({ "admin-1": admin, "cs-1": cs });
    clerkUsers.deleteUser.mockRejectedValue(new Error("clerk down"));
    await expect(callerFor(db).admin.delete({ id: "cs-1" })).resolves.toEqual({
      success: true,
    });
    expect(db.auditLog.create).toHaveBeenCalled();
  });
});
