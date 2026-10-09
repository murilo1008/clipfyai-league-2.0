import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ currentUser }));
vi.mock("@/server/db", () => ({ db: {} }));

import { notificationsRouter } from "./notifications";

const createdAt = new Date("2026-10-08T15:00:00Z");
const post = {
  id: "post-1",
  title: "Aviso",
  category: "GUIDANCE" as const,
  content: "Mensagem privada",
  linkUrl: null,
  createdAt,
  updatedAt: createdAt,
  notifications: [{ isRead: false }],
};
const record = {
  id: "notification-1",
  isRead: false,
  createdAt,
  announcement: {
    ...post,
    campaign: { id: "campaign-1", name: "Competição", slug: "competicao" },
  },
};

function setup(role = "CLIPPER") {
  const db = {
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: "clipper-1",
        verificationStatus: "VERIFIED",
        user: { role },
      }),
    },
    competitionAnnouncement: { findFirst: vi.fn().mockResolvedValue(post) },
    notification: {
      groupBy: vi.fn().mockResolvedValue([
        { campaignId: "campaign-1", _count: { id: 2 } },
        { campaignId: "campaign-2", _count: { id: 1 } },
      ]),
      findMany: vi.fn().mockResolvedValue([record]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    db,
    api: notificationsRouter.createCaller({
      db,
      headers: new Headers(),
    } as never),
  };
}

const visibility = {
  userId: "user-1",
  channel: "IN_APP",
  announcementId: { not: null },
  announcement: {
    OR: [
      { category: { not: "GUIDANCE" }, recipientClipperProfileId: null },
      { category: "GUIDANCE", recipientClipperProfileId: "clipper-1" },
    ],
    campaign: {
      status: { not: "ARCHIVED" },
      applications: {
        some: {
          clipperProfileId: "clipper-1",
          status: { in: ["APPROVED", "PENDING", "UNDER_REVIEW"] },
        },
      },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue({ id: "user-1" });
});

describe("notificações de avisos da competição", () => {
  it("lista somente avisos da competição aberta, mantendo o filtro de destinatário", async () => {
    const { api, db } = setup();
    const otherCompetition = {
      ...record,
      id: "notification-other",
      announcement: {
        ...record.announcement,
        id: "post-other",
        campaign: { id: "campaign-2", name: "Outra competição", slug: "outra" },
      },
    };
    db.notification.findMany.mockImplementation(async ({ where }) =>
      [record, otherCompetition].filter(
        (item) =>
          !where.announcement.campaign.slug ||
          item.announcement.campaign.slug === where.announcement.campaign.slug,
      ),
    );
    const result = await api.list({ slug: "competicao" });
    expect(result.items.map((item) => item.announcementId)).toEqual(["post-1"]);
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...visibility,
          announcement: {
            ...visibility.announcement,
            campaign: {
              ...visibility.announcement.campaign,
              slug: "competicao",
            },
          },
        },
      }),
    );
    expect(
      (await api.list({ slug: "outra" })).items.map(
        (item) => item.announcementId,
      ),
    ).toEqual(["post-other"]);
  });

  it("conta somente os avisos não lidos da competição solicitada", async () => {
    const { api, db } = setup();
    db.notification.groupBy.mockImplementation(async ({ where }) =>
      where.announcement.campaign.slug === "competicao"
        ? [{ campaignId: "campaign-1", _count: { id: 2 } }]
        : [
            { campaignId: "campaign-1", _count: { id: 2 } },
            { campaignId: "campaign-2", _count: { id: 1 } },
          ],
    );
    expect(await api.unreadSummary({ slug: "competicao" })).toEqual({
      total: 2,
      byCampaign: { "campaign-1": 2 },
    });
    expect(db.notification.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...visibility,
          isRead: false,
          announcement: {
            ...visibility.announcement,
            campaign: {
              ...visibility.announcement.campaign,
              slug: "competicao",
            },
          },
        },
      }),
    );
  });

  it("preserva a competição ao carregar páginas seguintes", async () => {
    const { api, db } = setup();
    const older = {
      ...record,
      id: "notification-0",
      createdAt: new Date("2026-10-07T15:00:00Z"),
    };
    db.notification.findMany.mockResolvedValueOnce([record, older]);
    const first = await api.list({ slug: "competicao", limit: 1 });
    db.notification.findMany.mockResolvedValueOnce([older]);
    await api.list({ slug: "competicao", limit: 1, cursor: first.nextCursor });
    expect(db.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          ...visibility,
          announcement: {
            ...visibility.announcement,
            campaign: {
              ...visibility.announcement.campaign,
              slug: "competicao",
            },
          },
          OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: record.id } },
          ],
        },
      }),
    );
  });

  it("não retorna avisos de outra competição quando o filtro não tem resultados", async () => {
    const { api, db } = setup();
    db.notification.findMany.mockResolvedValue([]);
    db.notification.groupBy.mockResolvedValue([]);
    expect((await api.list({ slug: "sem-avisos" })).items).toEqual([]);
    expect(await api.unreadSummary({ slug: "sem-avisos" })).toEqual({
      total: 0,
      byCampaign: {},
    });
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          announcement: expect.objectContaining({
            campaign: expect.objectContaining({ slug: "sem-avisos" }),
          }),
        }),
      }),
    );
  });

  it("rejeita um filtro vazio em vez de listar todas as competições", async () => {
    const { api, db } = setup();
    await expect(api.list({ slug: " " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(api.unreadSummary({ slug: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.notification.findMany).not.toHaveBeenCalled();
    expect(db.notification.groupBy).not.toHaveBeenCalled();
  });
  it("conta não lidas por competição usando somente o público autorizado", async () => {
    const { api, db } = setup();
    expect(await api.unreadSummary()).toEqual({
      total: 3,
      byCampaign: { "campaign-1": 2, "campaign-2": 1 },
    });
    expect(db.notification.groupBy).toHaveBeenCalledWith({
      by: ["campaignId"],
      where: { ...visibility, isRead: false },
      _count: { id: true },
    });
  });

  it("retorna zero quando não há alertas não lidos", async () => {
    const { api, db } = setup();
    db.notification.groupBy.mockResolvedValue([]);
    expect(await api.unreadSummary()).toEqual({ total: 0, byCampaign: {} });
  });

  it("lista notificações com link direto ao aviso e sem identidade do admin", async () => {
    const { api, db } = setup();
    const result = await api.list({ direction: "forward" });
    expect(result.items).toEqual([
      {
        id: "notification-1",
        isRead: false,
        createdAt,
        announcementId: "post-1",
        title: "Aviso",
        category: "GUIDANCE",
        campaignName: "Competição",
        actionUrl:
          "/my-competitions/competicao?tab=announcements&announcement=post-1",
      },
    ]);
    expect(result.nextCursor).toBeUndefined();
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: visibility, take: 21 }),
    );
    expect(result.items[0]).not.toHaveProperty("userId");
    expect(result.items[0]).not.toHaveProperty("metadata");
  });

  it("pagina alertas preservando o filtro de propriedade e destinatário", async () => {
    const { api, db } = setup();
    const older = {
      ...record,
      id: "notification-0",
      createdAt: new Date("2026-10-07T15:00:00Z"),
    };
    db.notification.findMany.mockResolvedValueOnce([record, older]);
    const page = await api.list({ limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toEqual({ id: record.id, createdAt });
    db.notification.findMany.mockResolvedValueOnce([older]);
    const next = await api.list({
      limit: 1,
      cursor: page.nextCursor,
      direction: "forward",
    });
    expect(next.nextCursor).toBeUndefined();
    expect(db.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          ...visibility,
          OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: record.id } },
          ],
        },
      }),
    );
  });

  it("abre apenas um aviso visível na competição solicitada", async () => {
    const { api, db } = setup();
    const result = await api.getAnnouncement({
      slug: "competicao",
      announcementId: "post-1",
    });
    expect(result).toEqual({
      ...post,
      notifications: undefined,
      isUnread: true,
    });
    expect(result).not.toHaveProperty("notifications");
    expect(db.competitionAnnouncement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "post-1",
          OR: visibility.announcement.OR,
          campaign: {
            slug: "competicao",
            status: { not: "ARCHIVED" },
            applications: {
              some: {
                clipperProfileId: "clipper-1",
                status: { in: ["APPROVED", "PENDING", "UNDER_REVIEW"] },
              },
            },
          },
        },
      }),
    );
  });

  it("não marca como lido apenas por listar ou consultar um aviso", async () => {
    const { api, db } = setup();
    await api.list({});
    await api.getAnnouncement({ slug: "competicao", announcementId: "post-1" });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });

  it("retorna a mesma indisponibilidade para aviso excluído ou pertencente a outro clipador", async () => {
    const { api, db } = setup();
    db.competitionAnnouncement.findFirst.mockResolvedValue(null);
    await expect(
      api.getAnnouncement({
        slug: "competicao",
        announcementId: "other-private-post",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Este aviso não está disponível para você.",
    });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });

  it("marca como lida somente a notificação do próprio usuário e de um aviso acessível", async () => {
    const { api, db } = setup();
    expect(await api.markRead({ announcementId: "post-1" })).toEqual({
      success: true,
      updated: 1,
    });
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { ...visibility, announcementId: "post-1", isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it("não altera nem expõe alertas de terceiros ou que já foram lidos", async () => {
    const { api, db } = setup();
    db.notification.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await api.markRead({ announcementId: "someone-elses-post" }),
    ).toEqual({ success: true, updated: 0 });
    expect(db.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  it("mantém o mesmo acesso ao abrir e ler após a inscrição voltar para análise", async () => {
    const { api, db } = setup();
    await api.getAnnouncement({ slug: "competicao", announcementId: "post-1" });
    await api.markRead({ announcementId: "post-1" });
    const lookup = db.competitionAnnouncement.findFirst.mock.calls[0]?.[0];
    const update = db.notification.updateMany.mock.calls[0]?.[0];
    expect(lookup?.where.campaign.applications.some).toEqual(
      update?.where.announcement.campaign.applications.some,
    );
    expect(
      update?.where.announcement.campaign.applications.some.status.in,
    ).toContain("UNDER_REVIEW");
  });

  it.each(["ADMIN", "CLIENT", "ORGANIZER_ADMIN"])(
    "impede %s de consultar a caixa privada de clipadores",
    async (role) => {
      const { api, db } = setup(role);
      await expect(api.unreadSummary()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(api.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        api.getAnnouncement({ slug: "competicao", announcementId: "post-1" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        api.markRead({ announcementId: "post-1" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.notification.findMany).not.toHaveBeenCalled();
      expect(db.notification.updateMany).not.toHaveBeenCalled();
    },
  );

  it("bloqueia clipadores banidos", async () => {
    const { api, db } = setup();
    db.clipperProfile.findUnique.mockResolvedValue({
      id: "clipper-1",
      verificationStatus: "BANNED",
      user: { role: "CLIPPER" },
    });
    await expect(api.unreadSummary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.notification.groupBy).not.toHaveBeenCalled();
  });

  it("exige autenticação", async () => {
    const { api, db } = setup();
    currentUser.mockResolvedValue(null);
    await expect(api.list({})).rejects.toThrow("Unauthorized");
    expect(db.notification.findMany).not.toHaveBeenCalled();
  });

  it("não aceita substituir o usuário ou o destinatário pela entrada da API", async () => {
    const { api, db } = setup();
    await expect(api.list({ userId: "victim" } as never)).rejects.toMatchObject(
      { code: "BAD_REQUEST" },
    );
    await expect(
      api.markRead({ announcementId: "post-1", userId: "victim" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.notification.findMany).not.toHaveBeenCalled();
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });
});
