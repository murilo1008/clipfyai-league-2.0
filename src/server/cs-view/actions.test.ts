import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, cookieStore, dbMock } = vi.hoisted(() => ({
  auth: vi.fn(),
  cookieStore: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
  dbMock: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/server/db", () => ({ db: dbMock }));
vi.mock("@/env", () => ({ env: { NODE_ENV: "production" } }));

import { CS_COOKIE_NAME } from "./cookie";
import { clearCsClient, selectCsClient } from "./actions";

const client = {
  id: "client-1",
  name: "Cliente X",
  email: "x@cliente.com",
  imageUrl: null,
  clientProfile: { company: "Empresa X" },
};

describe("selectCsClient (Server Action)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.auditLog.create.mockResolvedValue({});
  });

  it("recusa quem não está autenticado", async () => {
    auth.mockResolvedValue({ userId: null });
    await expect(selectCsClient("client-1")).resolves.toMatchObject({
      ok: false,
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("recusa id de cliente malformado", async () => {
    auth.mockResolvedValue({ userId: "cs-1" });
    await expect(selectCsClient("a:b")).resolves.toMatchObject({ ok: false });
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("recusa quem não é CS", async () => {
    auth.mockResolvedValue({ userId: "client-9" });
    dbMock.user.findUnique.mockResolvedValue({
      role: "CLIENT",
      csClientAccess: [],
    });
    await expect(selectCsClient("client-1")).resolves.toMatchObject({
      ok: false,
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("recusa cliente fora da allowlist", async () => {
    auth.mockResolvedValue({ userId: "cs-1" });
    dbMock.user.findUnique.mockResolvedValue({
      role: "CUSTOMER_SUCCESS",
      csClientAccess: [{ clientId: "client-2" }],
    });
    await expect(selectCsClient("client-1")).resolves.toMatchObject({
      ok: false,
    });
    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("recusa cliente inelegível", async () => {
    auth.mockResolvedValue({ userId: "cs-1" });
    dbMock.user.findUnique.mockResolvedValue({
      role: "CUSTOMER_SUCCESS",
      csClientAccess: [],
    });
    dbMock.user.findFirst.mockResolvedValue(null);
    await expect(selectCsClient("client-1")).resolves.toMatchObject({
      ok: false,
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("grava o cookie httpOnly amarrado ao ator e registra auditoria", async () => {
    auth.mockResolvedValue({ userId: "cs-1" });
    dbMock.user.findUnique.mockResolvedValue({
      role: "CUSTOMER_SUCCESS",
      csClientAccess: [],
    });
    dbMock.user.findFirst.mockResolvedValue(client);

    await expect(selectCsClient("client-1")).resolves.toEqual({
      ok: true,
      client: { id: "client-1", name: "Cliente X" },
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      CS_COOKIE_NAME,
      "cs-1:client-1",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      }),
    );
    expect(dbMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "cs-1",
        action: "LOGIN",
        entityType: "CsClientView",
        entityId: "client-1",
      }),
    });
  });

  it("falha na auditoria não impede a seleção", async () => {
    auth.mockResolvedValue({ userId: "cs-1" });
    dbMock.user.findUnique.mockResolvedValue({
      role: "CUSTOMER_SUCCESS",
      csClientAccess: [],
    });
    dbMock.user.findFirst.mockResolvedValue(client);
    dbMock.auditLog.create.mockRejectedValue(new Error("db down"));
    await expect(selectCsClient("client-1")).resolves.toMatchObject({
      ok: true,
    });
    expect(cookieStore.set).toHaveBeenCalled();
  });
});

describe("clearCsClient", () => {
  it("remove o cookie", async () => {
    await expect(clearCsClient()).resolves.toEqual({ ok: true });
    expect(cookieStore.delete).toHaveBeenCalledWith(CS_COOKIE_NAME);
  });
});
