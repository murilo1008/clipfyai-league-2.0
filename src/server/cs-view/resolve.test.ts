import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { CS_COOKIE_NAME } from "./cookie";
import { resolveCsView, resolveCsViewForRequest } from "./resolve";

const csActor = {
  id: "cs-1",
  name: "Ana CS",
  email: "ana@clipfy.ai",
  imageUrl: null,
  role: "CUSTOMER_SUCCESS",
  csClientAccess: [] as { clientId: string }[],
};
const client = {
  id: "client-1",
  name: "Cliente X",
  email: "x@cliente.com",
  imageUrl: "https://img/x.png",
  clientProfile: { company: "Empresa X" },
};

function makeDb(opts: { actor?: unknown; client?: unknown } = {}) {
  const db = {
    user: {
      findUnique: vi.fn().mockResolvedValue(opts.actor ?? null),
      findFirst: vi.fn().mockResolvedValue(opts.client ?? null),
    },
  };
  return db as unknown as PrismaClient & typeof db;
}

const header = (actorId: string, clientId: string) =>
  `theme=dark; ${CS_COOKIE_NAME}=${actorId}:${clientId}`;

describe("resolveCsView", () => {
  it("sem cookie: passthrough sem consultar o banco", async () => {
    const db = makeDb();
    const result = await resolveCsView({
      db,
      actorId: "cs-1",
      cookieHeader: null,
    });
    expect(result).toEqual({
      effectiveUserId: "cs-1",
      csView: null,
      stale: false,
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("cookie de outro usuário: ignorado sem consultar o banco", async () => {
    const db = makeDb({ actor: csActor, client });
    const result = await resolveCsView({
      db,
      actorId: "clipper-9",
      cookieHeader: header("cs-1", "client-1"),
    });
    expect(result).toEqual({
      effectiveUserId: "clipper-9",
      csView: null,
      stale: false,
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("ator que não é CS: passthrough (não é stale), sem buscar o cliente", async () => {
    const db = makeDb({
      actor: { ...csActor, id: "client-7", role: "CLIENT" },
      client,
    });
    const result = await resolveCsView({
      db,
      actorId: "client-7",
      cookieHeader: header("client-7", "client-1"),
    });
    expect(result.effectiveUserId).toBe("client-7");
    expect(result.csView).toBeNull();
    expect(result.stale).toBe(false);
    expect(result.actorRole).toBe("CLIENT");
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("CS sem allowlist + cliente elegível → usuário efetivo é o cliente", async () => {
    const db = makeDb({ actor: csActor, client });
    const result = await resolveCsView({
      db,
      actorId: "cs-1",
      cookieHeader: header("cs-1", "client-1"),
    });
    expect(result.effectiveUserId).toBe("client-1");
    expect(result.stale).toBe(false);
    expect(result.actorRole).toBe("CUSTOMER_SUCCESS");
    expect(result.csView).toEqual({
      actor: {
        id: "cs-1",
        name: "Ana CS",
        email: "ana@clipfy.ai",
        imageUrl: null,
      },
      client: {
        id: "client-1",
        name: "Cliente X",
        email: "x@cliente.com",
        imageUrl: "https://img/x.png",
        company: "Empresa X",
      },
    });
    const where = db.user.findFirst.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      id: "client-1",
      role: "CLIENT",
      clientCampaigns: { some: { status: { in: ["ACTIVE", "COMPLETED"] } } },
    });
    expect(where?.id).toBe("client-1");
  });

  it("allowlist restringe: cliente fora da lista vira stale sem consultar o cliente", async () => {
    const db = makeDb({
      actor: { ...csActor, csClientAccess: [{ clientId: "client-2" }] },
      client,
    });
    const result = await resolveCsView({
      db,
      actorId: "cs-1",
      cookieHeader: header("cs-1", "client-1"),
    });
    expect(result).toMatchObject({
      effectiveUserId: "cs-1",
      csView: null,
      stale: true,
    });
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("allowlist contendo o cliente consulta pelo id exato (não pelo `in`)", async () => {
    const db = makeDb({
      actor: {
        ...csActor,
        csClientAccess: [{ clientId: "client-1" }, { clientId: "client-2" }],
      },
      client,
    });
    await resolveCsView({
      db,
      actorId: "cs-1",
      cookieHeader: header("cs-1", "client-1"),
    });
    const where = db.user.findFirst.mock.calls[0]?.[0]?.where;
    // Regressão: a allowlist é conferida ANTES da consulta; a consulta precisa usar o
    // id EXATO (um `id: { in: [...] }` faria o findFirst devolver outro cliente).
    expect(where.id).toBe("client-1");
    expect(where).toMatchObject({
      id: "client-1",
      role: "CLIENT",
      clientCampaigns: { some: { status: { in: ["ACTIVE", "COMPLETED"] } } },
    });
  });

  it("cliente inelegível, rebaixado ou apagado → stale", async () => {
    const db = makeDb({ actor: csActor, client: null });
    const result = await resolveCsView({
      db,
      actorId: "cs-1",
      cookieHeader: header("cs-1", "client-1"),
    });
    expect(result).toMatchObject({
      effectiveUserId: "cs-1",
      csView: null,
      stale: true,
    });
  });

  it("aceita o valor do cookie diretamente (RSC via cookies())", async () => {
    const db = makeDb({ actor: csActor, client });
    const result = await resolveCsView({
      db,
      actorId: "cs-1",
      cookieValue: "cs-1:client-1",
    });
    expect(result.effectiveUserId).toBe("client-1");
  });
});

describe("resolveCsViewForRequest", () => {
  it("memoiza por objeto Headers (um batch resolve uma vez)", async () => {
    const db = makeDb({ actor: csActor, client });
    const headers = new Headers({ cookie: header("cs-1", "client-1") });
    const [a, b] = await Promise.all([
      resolveCsViewForRequest({ db, actorId: "cs-1", headers }),
      resolveCsViewForRequest({ db, actorId: "cs-1", headers }),
    ]);
    expect(a).toBe(b);
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("sem headers: passthrough", async () => {
    const db = makeDb({ actor: csActor, client });
    const result = await resolveCsViewForRequest({
      db,
      actorId: "cs-1",
      headers: undefined,
    });
    expect(result).toEqual({
      effectiveUserId: "cs-1",
      csView: null,
      stale: false,
    });
  });
});
