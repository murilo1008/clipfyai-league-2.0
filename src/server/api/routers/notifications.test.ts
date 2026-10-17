import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { invalidateCachedQueries } from "@/server/memory-cache";
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

type ProfileRow = {
  id: string;
  userId: string;
  verificationStatus: string;
  user: { role: string };
};

// Aplica os filtros que o banco aplicaria na consulta única de perfil + papel.
function findProfile(rows: ProfileRow[]) {
  return vi.fn(
    async ({
      where,
    }: {
      where: {
        userId: string;
        verificationStatus?: { not: string };
        user?: { role: string };
      };
    }) => {
      const row = rows.find(
        (profile) =>
          profile.userId === where.userId &&
          (!where.verificationStatus ||
            profile.verificationStatus !== where.verificationStatus.not) &&
          (!where.user || profile.user.role === where.user.role),
      );
      return row ? { id: row.id } : null;
    },
  );
}

function setup(role = "CLIPPER") {
  const profile: ProfileRow = {
    id: "clipper-1",
    userId: "user-1",
    verificationStatus: "VERIFIED",
    user: { role },
  };
  const db = {
    clipperProfile: { findUnique: findProfile([profile]) },
    competitionAnnouncement: { findFirst: vi.fn().mockResolvedValue(post) },
    notification: {
      groupBy: vi.fn().mockResolvedValue([
        { campaignId: "campaign-1", _count: { id: 2 } },
        { campaignId: "campaign-2", _count: { id: 1 } },
      ]),
      findMany: vi.fn().mockResolvedValue([record]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      // Alertas de advertência não lidos (contador do sino).
      count: vi.fn().mockResolvedValue(0),
    },
  };
  return {
    db,
    profile,
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

const alertVisibility = {
  userId: "user-1",
  channel: "IN_APP",
  announcementId: null,
  type: "SYSTEM_ALERT",
  metadata: { path: ["kind"], equals: "clipper_warning" },
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCachedQueries("");
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
      alerts: 0,
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
      alerts: 0,
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
      alerts: 0,
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
    expect(await api.unreadSummary()).toEqual({ total: 0, byCampaign: {}, alerts: 0 });
  });

  it("lista notificações com link direto ao aviso e sem identidade do admin", async () => {
    const { api, db } = setup();
    const result = await api.list({ direction: "forward" });
    expect(result.items).toEqual([
      {
        kind: "announcement",
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
      expect.objectContaining({
        where: { AND: [{ OR: [visibility, alertVisibility] }] },
        take: 21,
      }),
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
          AND: [{ OR: [visibility, alertVisibility] }],
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
    const { api, db, profile } = setup();
    profile.verificationStatus = "BANNED";
    await expect(api.unreadSummary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(api.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      api.markRead({ announcementId: "post-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.notification.groupBy).not.toHaveBeenCalled();
    expect(db.notification.findMany).not.toHaveBeenCalled();
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });

  it("bloqueia usuários sem perfil de clipador", async () => {
    const { api, db } = setup();
    currentUser.mockResolvedValue({ id: "user-sem-perfil" });
    await expect(api.unreadSummary()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Acesso restrito aos clipadores participantes.",
    });
    expect(db.notification.groupBy).not.toHaveBeenCalled();
  });

  it("valida perfil, papel e banimento numa única consulta", async () => {
    const { api, db } = setup();
    await api.unreadSummary();
    expect(db.clipperProfile.findUnique).toHaveBeenCalledTimes(1);
    expect(db.clipperProfile.findUnique).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        verificationStatus: { not: "BANNED" },
        user: { role: "CLIPPER" },
      },
      select: { id: true },
    });
  });

  it("reaproveita por alguns segundos o contador zerado do mesmo usuário e filtro", async () => {
    const { api, db } = setup();
    db.notification.groupBy.mockResolvedValue([]);
    const first = await api.unreadSummary({ slug: "competicao" });
    expect(first).toEqual({ total: 0, byCampaign: {}, alerts: 0 });
    expect(await api.unreadSummary({ slug: "competicao" })).toEqual(first);
    expect(db.notification.groupBy).toHaveBeenCalledTimes(1);
    expect(db.clipperProfile.findUnique).toHaveBeenCalledTimes(1);

    // Outro filtro é outra chave.
    await api.unreadSummary();
    expect(db.notification.groupBy).toHaveBeenCalledTimes(2);
  });

  it("não guarda contador com avisos pendentes: a próxima leitura vem do banco", async () => {
    const { api, db } = setup();
    expect((await api.unreadSummary({ slug: "competicao" })).total).toBe(3);
    db.notification.groupBy.mockResolvedValue([
      { campaignId: "campaign-1", _count: { id: 1 } },
    ]);
    expect(await api.unreadSummary({ slug: "competicao" })).toEqual({
      total: 1,
      byCampaign: { "campaign-1": 1 },
      alerts: 0,
    });
    expect(db.notification.groupBy).toHaveBeenCalledTimes(2);
  });

  it("não compartilha o contador entre usuários", async () => {
    const { api, db } = setup();
    db.clipperProfile.findUnique = findProfile([
      {
        id: "clipper-1",
        userId: "user-1",
        verificationStatus: "VERIFIED",
        user: { role: "CLIPPER" },
      },
      {
        id: "clipper-2",
        userId: "user-2",
        verificationStatus: "VERIFIED",
        user: { role: "CLIPPER" },
      },
    ]);
    db.notification.groupBy.mockImplementation(async ({ where }) =>
      where.userId === "user-1"
        ? []
        : [{ campaignId: "campaign-9", _count: { id: 5 } }],
    );
    expect(await api.unreadSummary()).toEqual({ total: 0, byCampaign: {}, alerts: 0 });
    currentUser.mockResolvedValue({ id: "user-2" });
    expect(await api.unreadSummary()).toEqual({
      total: 5,
      byCampaign: { "campaign-9": 5 },
      alerts: 0,
    });
    expect(db.notification.groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-2" }),
      }),
    );
  });

  it("descarta o contador em cache ao marcar um aviso como lido", async () => {
    const { api, db } = setup();
    db.notification.groupBy.mockResolvedValue([]);
    expect((await api.unreadSummary({ slug: "competicao" })).total).toBe(0);
    // Chegaram avisos depois da leitura em cache.
    db.notification.groupBy.mockResolvedValue([
      { campaignId: "campaign-1", _count: { id: 2 } },
    ]);
    expect((await api.unreadSummary({ slug: "competicao" })).total).toBe(0);
    await api.markRead({ announcementId: "post-1" });
    db.notification.groupBy.mockResolvedValue([
      { campaignId: "campaign-1", _count: { id: 1 } },
    ]);
    expect(await api.unreadSummary({ slug: "competicao" })).toEqual({
      total: 1,
      byCampaign: { "campaign-1": 1 },
      alerts: 0,
    });
    expect(db.notification.groupBy).toHaveBeenCalledTimes(2);
  });

  it("não guarda falhas no cache do contador", async () => {
    const { api, db, profile } = setup();
    profile.verificationStatus = "BANNED";
    await expect(api.unreadSummary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    profile.verificationStatus = "VERIFIED";
    expect((await api.unreadSummary()).total).toBe(3);
    expect(db.notification.groupBy).toHaveBeenCalledTimes(1);
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

describe("alertas de advertência no sino", () => {
  const alert = {
    id: "notification-alert",
    isRead: false,
    createdAt,
    title: "Advertência 1 aplicada",
    message: "Motivo: hashtag faltando.",
    actionUrl: "/warnings",
    announcement: null,
  };

  it("soma os alertas não lidos ao total, fora do contador por competição", async () => {
    const { api, db } = setup();
    db.notification.count.mockResolvedValue(2);
    expect(await api.unreadSummary()).toEqual({
      total: 5,
      byCampaign: { "campaign-1": 2, "campaign-2": 1 },
      alerts: 2,
    });
    expect(db.notification.count).toHaveBeenCalledWith({
      where: { ...alertVisibility, isRead: false },
    });
  });

  it("não conta alertas no contador de uma competição", async () => {
    const { api, db } = setup();
    db.notification.count.mockResolvedValue(2);
    db.notification.groupBy.mockResolvedValue([
      { campaignId: "campaign-1", _count: { id: 2 } },
    ]);
    expect(await api.unreadSummary({ slug: "competicao" })).toEqual({
      total: 2,
      byCampaign: { "campaign-1": 2 },
      alerts: 0,
    });
    expect(db.notification.count).not.toHaveBeenCalled();
  });

  it("lista o alerta com título, mensagem e link", async () => {
    const { api, db } = setup();
    db.notification.findMany.mockResolvedValue([alert, record]);
    const result = await api.list({});
    expect(result.items[0]).toEqual({
      kind: "clipper_warning",
      id: "notification-alert",
      isRead: false,
      createdAt,
      title: "Advertência 1 aplicada",
      message: "Motivo: hashtag faltando.",
      actionUrl: "/warnings",
    });
    expect(result.items[1]).toMatchObject({ kind: "announcement", id: "notification-1" });
  });

  it("marca como lido só o alerta do próprio usuário", async () => {
    const { api, db } = setup();
    expect(
      await api.markAlertRead({ notificationId: "notification-alert" }),
    ).toEqual({ success: true, updated: 1 });
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: {
        ...alertVisibility,
        id: "notification-alert",
        isRead: false,
      },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});
