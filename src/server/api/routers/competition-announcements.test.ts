import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { currentUser, sendEmails } = vi.hoisted(() => ({
  currentUser: vi.fn(),
  sendEmails: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ currentUser }));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/competition-announcement-emails", () => ({
  sendCompetitionAnnouncementEmails: sendEmails,
}));

import { competitionAnnouncementsRouter } from "./competition-announcements";
const fields = {
  category: "RULES" as const,
  title: "Regras da competição",
  content: "Use as hashtags obrigatórias.\nConfira o regulamento.",
  linkUrl: "https://example.com/regras",
};
const post = {
  id: "post-1",
  ...fields,
  createdAt: new Date("2026-10-08T15:00:00Z"),
  updatedAt: new Date("2026-10-08T15:00:00Z"),
};

const clipperVisibility = {
  AND: [
    {
      OR: [
        { category: { not: "GUIDANCE" }, recipientClipperProfileId: null },
        { category: "GUIDANCE", recipientClipperProfileId: "clipper-1" },
      ],
    },
  ],
};

function setup(role = "ADMIN") {
  const db = {
    $transaction: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: { findUnique: vi.fn().mockResolvedValue({ role }) },
    campaign: {
      findUnique: vi.fn().mockResolvedValue({
        id: "campaign-1",
        name: "Competição",
        slug: "competicao",
        status: "ACTIVE",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: "clipper-1",
        verificationStatus: "VERIFIED",
        user: { role },
      }),
    },
    clipperApplication: {
      count: vi.fn().mockResolvedValue(3),
      findFirst: vi.fn().mockResolvedValue({
        clipperProfile: {
          user: { id: "selected-user", email: "selected@example.com" },
        },
      }),
      findUnique: vi.fn().mockResolvedValue({ status: "APPROVED" }),
      findMany: vi.fn().mockResolvedValue([
        {
          clipperProfile: {
            user: { id: "clipper-user", email: "clipper@example.com" },
          },
        },
      ]),
    },
    competitionAnnouncement: {
      findFirst: vi.fn().mockResolvedValue({
        ...post,
        campaign: { name: "Competição", slug: "competicao", status: "ACTIVE" },
      }),
      create: vi.fn().mockResolvedValue({
        ...post,
        notifyClippers: false,
        notificationSentAt: null,
        notificationRecipientCount: 0,
        notificationLastError: null,
      }),
      findMany: vi.fn().mockResolvedValue([post]),
      update: vi.fn().mockResolvedValue(post),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  db.$transaction.mockImplementation(
    (callback: (transaction: typeof db) => Promise<unknown>) => callback(db),
  );
  const api = competitionAnnouncementsRouter.createCaller({
    db,
    headers: new Headers(),
  } as never);
  return { api, db };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue({
    id: "authenticated-user",
    emailAddresses: [{ emailAddress: "admin-private@example.com" }],
  });
  sendEmails.mockResolvedValue({ sent: 1, error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("admin: mural das competições", () => {
  it("impede publicações e e-mails em uma competição arquivada", async () => {
    const { api, db } = setup();
    db.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      name: "Competição",
      slug: "competicao",
      status: "ARCHIVED",
    });
    await expect(
      api.create({ campaignId: "campaign-1", ...fields, notifyClippers: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
    expect(sendEmails).not.toHaveBeenCalled();
  });

  it("impede edições em uma competição arquivada sem recriar alertas", async () => {
    const { api, db } = setup();
    db.competitionAnnouncement.findFirst.mockResolvedValue({
      ...post,
      campaign: { name: "Competição", slug: "competicao", status: "ARCHIVED" },
    });
    await expect(
      api.update({ id: "post-1", campaignId: "campaign-1", ...fields }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.competitionAnnouncement.updateMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("registra o resultado do envio sem sobrescrever conteúdo ou a data de uma edição concorrente", async () => {
    const { api, db } = setup();
    const editedAt = new Date("2026-10-08T15:05:00Z");
    sendEmails.mockImplementationOnce(async () => {
      await api.update({
        id: post.id,
        campaignId: "campaign-1",
        ...fields,
        title: "Título atualizado",
      });
      return { sent: 1, error: null };
    });
    await api.create({
      campaignId: "campaign-1",
      ...fields,
      notifyClippers: true,
    });
    const sql = db.$executeRaw.mock.calls[0]?.[0].join("");
    expect(sql).not.toMatch(/"(?:updatedAt|title|content)"\s*=/);
    expect(db.$executeRaw.mock.calls[0]).not.toContain(post.updatedAt);
    expect(db.$executeRaw.mock.calls[0]).not.toContain(editedAt);
    expect(db.competitionAnnouncement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Título atualizado" }),
      }),
    );
  });

  it("não falha a publicação se o aviso for excluído enquanto os e-mails são enviados", async () => {
    const { api, db } = setup();
    db.$executeRaw.mockResolvedValue(0);
    const result = await api.create({
      campaignId: "campaign-1",
      ...fields,
      notifyClippers: true,
    });
    expect(result.notified).toBe(1);
    expect(result.notificationError).toContain("registrar o resultado");
  });
  it("publica sem e-mail e sem persistir dados do admin", async () => {
    const { api, db } = setup();
    const result = await api.create({ campaignId: "campaign-1", ...fields });

    expect(result.notified).toBe(0);
    expect(result.post.id).toBe(post.id);
    expect(sendEmails).not.toHaveBeenCalled();
    expect(db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            userId: "clipper-user",
            announcementId: "post-1",
            channel: "IN_APP",
          }),
        ],
      }),
    );
    expect(result.inAppNotified).toBe(1);
    expect(db.competitionAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          campaignId: "campaign-1",
          ...fields,
          notifyClippers: false,
          recipientClipperProfileId: null,
        },
      }),
    );
    expect(JSON.stringify(result)).not.toContain("admin-private@example.com");
    expect(JSON.stringify(result)).not.toContain("authenticated-user");
  });

  it("rejeita identificação do autor e campos não previstos", async () => {
    const { api, db } = setup();
    await expect(
      api.create({
        campaignId: "campaign-1",
        ...fields,
        authorId: "admin",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
  });

  it("envia apenas aos clipadores aprovados da competição selecionada", async () => {
    const { api, db } = setup();
    const result = await api.create({
      campaignId: "campaign-1",
      ...fields,
      notifyClippers: true,
    });

    expect(db.clipperApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: "campaign-1",
          status: "APPROVED",
          clipperProfile: {
            verificationStatus: { not: "BANNED" },
            user: { role: "CLIPPER" },
          },
        },
      }),
    );
    expect(sendEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        announcementId: "post-1",
        campaignSlug: "competicao",
        recipients: ["clipper@example.com"],
      }),
    );
    expect(result.notified).toBe(1);
    expect(result.notificationError).toBeNull();
    expect(db.$executeRaw).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Date),
      1,
      null,
      post.id,
    );
    expect(db.$executeRaw.mock.calls[0]?.[0].join("")).not.toContain(
      "updatedAt",
    );
    expect(db.competitionAnnouncement.update).not.toHaveBeenCalled();
  });

  it("mantém a publicação e registra envios parciais quando o e-mail falha", async () => {
    sendEmails.mockResolvedValue({
      sent: 3,
      error: "Limite de envio excedido",
    });
    const { api, db } = setup();
    const result = await api.create({
      campaignId: "campaign-1",
      ...fields,
      notifyClippers: true,
    });

    expect(result.post.id).toBe("post-1");
    expect(result.notified).toBe(3);
    expect(result.notificationError).toBe("Limite de envio excedido");
    expect(db.$executeRaw).toHaveBeenCalledWith(
      expect.any(Array),
      null,
      3,
      "Limite de envio excedido",
      post.id,
    );
    expect(db.competitionAnnouncement.deleteMany).not.toHaveBeenCalled();
  });

  it("não retorna erro de publicação quando o serviço de e-mail lança uma exceção", async () => {
    sendEmails.mockRejectedValue(new Error("Network error"));
    const { api } = setup();
    const result = await api.create({
      campaignId: "campaign-1",
      ...fields,
      notifyClippers: true,
    });
    expect(result.post.id).toBe("post-1");
    expect(result.notificationError).toContain("A postagem está publicada");
  });

  it("não incentiva uma publicação duplicada se falhar o registro do envio", async () => {
    const { api, db } = setup();
    db.$executeRaw.mockRejectedValue(new Error("Database unavailable"));
    const result = await api.create({
      campaignId: "campaign-1",
      ...fields,
      notifyClippers: true,
    });
    expect(result.post.id).toBe("post-1");
    expect(result.notified).toBe(1);
    expect(result.notificationError).toContain("registrar o resultado");
  });

  it("não publica para uma competição inexistente", async () => {
    const { api, db } = setup();
    db.campaign.findUnique.mockResolvedValue(null);
    await expect(
      api.create({ campaignId: "missing", ...fields }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
  });

  it.each(["CLIPPER", "CLIENT", "ORGANIZER_ADMIN"])(
    "impede %s de gerenciar o mural",
    async (role) => {
      const { api, db } = setup(role);
      await expect(api.campaigns()).rejects.toThrow("Admin access required");
      await expect(
        api.recipients({ campaignId: "campaign-1" }),
      ).rejects.toThrow("Admin access required");
      await expect(api.listAdmin({ campaignId: "campaign-1" })).rejects.toThrow(
        "Admin access required",
      );
      await expect(
        api.create({ campaignId: "campaign-1", ...fields }),
      ).rejects.toThrow("Admin access required");
      await expect(
        api.update({ id: "post-1", campaignId: "campaign-1", ...fields }),
      ).rejects.toThrow("Admin access required");
      await expect(
        api.delete({ id: "post-1", campaignId: "campaign-1" }),
      ).rejects.toThrow("Admin access required");
      expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
      expect(db.competitionAnnouncement.updateMany).not.toHaveBeenCalled();
      expect(db.competitionAnnouncement.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("edita sem reenviar e-mail e exige que o post pertença à competição", async () => {
    const { api, db } = setup();
    await api.update({ id: "post-1", campaignId: "campaign-1", ...fields });
    expect(db.competitionAnnouncement.updateMany).toHaveBeenCalledWith({
      where: { id: "post-1", campaignId: "campaign-1" },
      data: { ...fields, recipientClipperProfileId: null },
    });
    expect(sendEmails).not.toHaveBeenCalled();
    db.competitionAnnouncement.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      api.update({ id: "post-1", campaignId: "other-campaign", ...fields }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("exclui apenas na competição selecionada", async () => {
    const { api, db } = setup();
    await api.delete({ id: "post-1", campaignId: "campaign-1" });
    expect(db.competitionAnnouncement.deleteMany).toHaveBeenCalledWith({
      where: { id: "post-1", campaignId: "campaign-1" },
    });
    db.competitionAnnouncement.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      api.delete({ id: "post-1", campaignId: "other-campaign" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    { title: "   " },
    { content: "\n\t " },
    { linkUrl: "javascript:alert(1)" },
    { linkUrl: "ftp://example.com" },
    { category: "OTHER" },
  ])("valida campos antes de publicar: %j", async (invalid) => {
    const { api, db } = setup();
    await expect(
      api.create({ campaignId: "campaign-1", ...fields, ...invalid } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
  });
});

describe("clipador: acesso ao mural", () => {
  it("separa os avisos ao alternar entre duas competições do mesmo clipador", async () => {
    const { api, db } = setup("CLIPPER");
    const campaigns = [
      { id: "campaign-x", slug: "competicao-x", status: "ACTIVE" },
      { id: "campaign-y", slug: "competicao-y", status: "ACTIVE" },
    ];
    const notices = [
      { ...post, id: "post-x", campaignId: "campaign-x" },
      { ...post, id: "post-y", campaignId: "campaign-y" },
    ];
    db.campaign.findUnique.mockImplementation(async ({ where }) =>
      campaigns.find((campaign) => campaign.slug === where.slug),
    );
    db.competitionAnnouncement.findMany.mockImplementation(async ({ where }) =>
      notices
        .filter((notice) => notice.campaignId === where.campaignId)
        .map(({ campaignId: _campaignId, ...notice }) => notice),
    );
    expect(
      (await api.listForClipper({ slug: "competicao-x" })).items.map(
        (item) => item.id,
      ),
    ).toEqual(["post-x"]);
    expect(
      (await api.listForClipper({ slug: "competicao-y" })).items.map(
        (item) => item.id,
      ),
    ).toEqual(["post-y"]);
    expect(db.clipperApplication.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          campaignId_clipperProfileId: {
            campaignId: "campaign-y",
            clipperProfileId: "clipper-1",
          },
        },
      }),
    );
  });
  it("retorna apenas conteúdo público, isolado por competição e categoria", async () => {
    const { api, db } = setup("CLIPPER");
    const result = await api.listForClipper({
      slug: "competicao",
      category: "RULES",
      direction: "forward",
    });
    expect(result.items).toEqual([{ ...post, isUnread: false }]);
    expect(db.competitionAnnouncement.findMany).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-1",
        category: "RULES",
        ...clipperVisibility,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      select: {
        id: true,
        category: true,
        title: true,
        content: true,
        linkUrl: true,
        createdAt: true,
        updatedAt: true,
        notifications: {
          where: { userId: "authenticated-user", channel: "IN_APP" },
          select: { isRead: true },
          take: 1,
        },
      },
    });
    expect(db.clipperApplication.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId_clipperProfileId: {
            campaignId: "campaign-1",
            clipperProfileId: "clipper-1",
          },
        },
      }),
    );
  });

  it.each(["PENDING", "UNDER_REVIEW", "APPROVED"])(
    "permite que um inscrito %s consulte as informações",
    async (status) => {
      const { api, db } = setup("CLIPPER");
      db.clipperApplication.findUnique.mockResolvedValue({ status });
      expect((await api.listForClipper({ slug: "competicao" })).items).toEqual([
        { ...post, isUnread: false },
      ]);
    },
  );

  it.each([null, { status: "REJECTED" }, { status: "REVOKED" }])(
    "bloqueia não participantes: %j",
    async (application) => {
      const { api, db } = setup("CLIPPER");
      db.clipperApplication.findUnique.mockResolvedValue(application);
      await expect(
        api.listForClipper({ slug: "competicao" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.competitionAnnouncement.findMany).not.toHaveBeenCalled();
    },
  );

  it("bloqueia competições arquivadas", async () => {
    const { api, db } = setup("CLIPPER");
    db.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      status: "ARCHIVED",
    });
    await expect(
      api.listForClipper({ slug: "competicao" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.competitionAnnouncement.findMany).not.toHaveBeenCalled();
  });

  it("bloqueia clipadores banidos", async () => {
    const { api, db } = setup("CLIPPER");
    db.clipperProfile.findUnique.mockResolvedValue({
      id: "clipper-1",
      verificationStatus: "BANNED",
      user: { role: "CLIPPER" },
    });
    await expect(
      api.listForClipper({ slug: "competicao" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.competitionAnnouncement.findMany).not.toHaveBeenCalled();
  });

  it("bloqueia clientes mesmo que tenham um perfil de clipador antigo", async () => {
    const { api, db } = setup("CLIENT");
    await expect(
      api.listForClipper({ slug: "competicao" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.competitionAnnouncement.findMany).not.toHaveBeenCalled();
  });

  it("exige autenticação", async () => {
    const { api, db } = setup("CLIPPER");
    currentUser.mockResolvedValue(null);
    await expect(api.listForClipper({ slug: "competicao" })).rejects.toThrow(
      "Unauthorized",
    );
    expect(db.competitionAnnouncement.findMany).not.toHaveBeenCalled();
  });

  it("pagina por data e id sem misturar competições", async () => {
    const { api, db } = setup("CLIPPER");
    const older = {
      ...post,
      id: "post-0",
      createdAt: new Date("2026-10-07T15:00:00Z"),
    };
    db.competitionAnnouncement.findMany.mockResolvedValueOnce([post, older]);
    const result = await api.listForClipper({ slug: "competicao", limit: 1 });
    expect(result.items).toEqual([{ ...post, isUnread: false }]);
    expect(result.nextCursor).toEqual({
      id: post.id,
      createdAt: post.createdAt,
    });
    db.competitionAnnouncement.findMany.mockResolvedValueOnce([older]);
    const next = await api.listForClipper({
      slug: "competicao",
      limit: 1,
      cursor: result.nextCursor,
      direction: "forward",
    });
    expect(next.items).toEqual([{ ...older, isUnread: false }]);
    expect(next.nextCursor).toBeUndefined();
    expect(db.competitionAnnouncement.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          campaignId: "campaign-1",
          category: undefined,
          ...clipperVisibility,
          OR: [
            { createdAt: { lt: post.createdAt } },
            { createdAt: post.createdAt, id: { lt: post.id } },
          ],
        },
      }),
    );
  });
});

describe("notificações internas na publicação", () => {
  it("cria os alertas e a postagem na mesma transação sem depender do e-mail", async () => {
    const { api, db } = setup();
    const result = await api.create({ campaignId: "campaign-1", ...fields });
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(result.inAppNotified).toBe(1);
    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "clipper-user",
          campaignId: "campaign-1",
          announcementId: "post-1",
          type: "SYSTEM_ALERT",
          channel: "IN_APP",
          title: fields.title,
          message: "Competição · Regras",
          metadata: { category: "RULES" },
          sentAt: expect.any(Date),
          actionUrl:
            "/my-competitions/competicao?tab=announcements&announcement=post-1",
          idempotencyKey: "competition-announcement:post-1:clipper-user",
        },
      ],
      skipDuplicates: true,
    });
    expect(sendEmails).not.toHaveBeenCalled();
    expect(JSON.stringify(db.notification.createMany.mock.calls)).not.toContain(
      "authenticated-user",
    );
    expect(JSON.stringify(db.notification.createMany.mock.calls)).not.toContain(
      "admin-private@example.com",
    );
  });

  it("notifica apenas o clipador escolhido num direcionamento privado", async () => {
    const { api, db } = setup();
    await api.create({
      campaignId: "campaign-1",
      ...fields,
      category: "GUIDANCE",
      recipientClipperProfileId: "selected-clipper",
    });
    expect(db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            userId: "selected-user",
            metadata: { category: "GUIDANCE" },
          }),
        ],
      }),
    );
    expect(db.clipperApplication.findMany).not.toHaveBeenCalled();
  });

  it("preserva a notificação quando o e-mail falha", async () => {
    const { api, db } = setup();
    sendEmails.mockRejectedValue(new Error("Email failure"));
    const result = await api.create({
      campaignId: "campaign-1",
      ...fields,
      notifyClippers: true,
    });
    expect(result.inAppNotified).toBe(1);
    expect(result.notificationError).not.toBeNull();
    expect(db.notification.createMany).toHaveBeenCalledOnce();
  });

  it("não envia e-mail se a transação de publicação e alertas falhar", async () => {
    const { api, db } = setup();
    db.notification.createMany.mockRejectedValue(
      new Error("Cannot persist notification"),
    );
    await expect(
      api.create({ campaignId: "campaign-1", ...fields, notifyClippers: true }),
    ).rejects.toThrow("Cannot persist notification");
    expect(sendEmails).not.toHaveBeenCalled();
  });

  it("publica normalmente quando não há destinatários aprovados", async () => {
    const { api, db } = setup();
    db.clipperApplication.findMany.mockResolvedValue([]);
    const result = await api.create({ campaignId: "campaign-1", ...fields });
    expect(result.inAppNotified).toBe(0);
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("remove os alertas dos destinatários anteriores ao tornar um aviso privado", async () => {
    const { api, db } = setup();
    await api.update({
      id: "post-1",
      campaignId: "campaign-1",
      ...fields,
      category: "GUIDANCE",
      recipientClipperProfileId: "selected-clipper",
    });
    expect(db.notification.deleteMany).toHaveBeenCalledWith({
      where: { announcementId: "post-1", userId: { notIn: ["selected-user"] } },
    });
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { announcementId: "post-1" },
      data: expect.not.objectContaining({ isRead: expect.anything() }),
    });
    expect(db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [expect.objectContaining({ userId: "selected-user" })],
      }),
    );
  });

  it("retorna o estado de leitura somente do próprio usuário no mural", async () => {
    const { api, db } = setup("CLIPPER");
    db.competitionAnnouncement.findMany.mockResolvedValue([
      { ...post, notifications: [{ isRead: false }] },
    ]);
    const result = await api.listForClipper({ slug: "competicao" });
    expect(result.items[0]?.isUnread).toBe(true);
    expect(result.items[0]).not.toHaveProperty("notifications");
  });
});

describe("direcionamentos para um clipador específico", () => {
  const guidance = {
    ...fields,
    category: "GUIDANCE" as const,
    recipientClipperProfileId: "selected-clipper",
  };

  it("exige um destinatário ao criar e ao editar um direcionamento", async () => {
    const { api, db } = setup();
    for (const recipientClipperProfileId of [undefined, null, "", "  "]) {
      const invalid = {
        ...fields,
        category: "GUIDANCE" as const,
        recipientClipperProfileId,
      };
      await expect(
        api.create({ campaignId: "campaign-1", ...invalid }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        api.update({ campaignId: "campaign-1", id: "post-1", ...invalid }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
    expect(db.competitionAnnouncement.updateMany).not.toHaveBeenCalled();
  });

  it.each(["CONTENT", "RULES", "NOTICE", "CLIPFY_NOTICE"])(
    "não permite destinatário individual na categoria %s",
    async (category) => {
      const { api, db } = setup();
      await expect(
        api.create({
          campaignId: "campaign-1",
          ...guidance,
          category,
        } as never),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
    },
  );

  it("publica apenas para o clipador selecionado mesmo sem enviar e-mail", async () => {
    const { api, db } = setup();
    await api.create({ campaignId: "campaign-1", ...guidance });
    expect(db.competitionAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { campaignId: "campaign-1", ...guidance, notifyClippers: false },
      }),
    );
    expect(sendEmails).not.toHaveBeenCalled();
    expect(db.clipperApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: "campaign-1",
          clipperProfileId: "selected-clipper",
          status: "APPROVED",
          clipperProfile: {
            verificationStatus: { not: "BANNED" },
            user: { role: "CLIPPER" },
          },
        },
      }),
    );
  });

  it("envia o e-mail somente ao destinatário, sem consultar a lista de todos os clipadores", async () => {
    const { api, db } = setup();
    const result = await api.create({
      campaignId: "campaign-1",
      ...guidance,
      notifyClippers: true,
    });
    expect(result.notified).toBe(1);
    expect(sendEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "GUIDANCE",
        recipients: ["selected@example.com"],
      }),
    );
    expect(db.clipperApplication.findMany).not.toHaveBeenCalled();
  });

  it("recusa um destinatário que não é aprovado na competição selecionada", async () => {
    const { api, db } = setup();
    db.clipperApplication.findFirst.mockResolvedValue(null);
    await expect(
      api.create({
        campaignId: "other-campaign",
        ...guidance,
        notifyClippers: true,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      api.update({ campaignId: "other-campaign", id: "post-1", ...guidance }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.clipperApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: "other-campaign",
          clipperProfileId: "selected-clipper",
        }),
      }),
    );
    expect(db.competitionAnnouncement.create).not.toHaveBeenCalled();
    expect(db.competitionAnnouncement.updateMany).not.toHaveBeenCalled();
    expect(sendEmails).not.toHaveBeenCalled();
  });

  it("mantém o direcionamento privado quando o envio de e-mail falha", async () => {
    const { api, db } = setup();
    sendEmails.mockRejectedValue(new Error("Network error"));
    const result = await api.create({
      campaignId: "campaign-1",
      ...guidance,
      notifyClippers: true,
    });
    expect(result.notificationError).not.toBeNull();
    expect(db.competitionAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "GUIDANCE",
          recipientClipperProfileId: "selected-clipper",
        }),
      }),
    );
    expect(db.clipperApplication.findMany).not.toHaveBeenCalled();
  });

  it("preserva o destinatário ao editar e remove a restrição somente ao mudar para uma categoria geral", async () => {
    const { api, db } = setup();
    await api.update({ campaignId: "campaign-1", id: "post-1", ...guidance });
    expect(db.competitionAnnouncement.updateMany).toHaveBeenLastCalledWith({
      where: { id: "post-1", campaignId: "campaign-1" },
      data: guidance,
    });
    await api.update({ campaignId: "campaign-1", id: "post-1", ...fields });
    expect(db.competitionAnnouncement.updateMany).toHaveBeenLastCalledWith({
      where: { id: "post-1", campaignId: "campaign-1" },
      data: { ...fields, recipientClipperProfileId: null },
    });
    expect(sendEmails).not.toHaveBeenCalled();
  });

  it("oferece busca de destinatários apenas entre os aprovados da competição", async () => {
    const { api, db } = setup();
    const recipient = {
      id: "selected-clipper",
      fullName: "Ana",
      artisticName: "Ana Clips",
      user: { email: "ana@example.com" },
    };
    db.clipperApplication.findMany.mockResolvedValue([
      { clipperProfile: recipient },
    ]);
    const result = await api.recipients({
      campaignId: "campaign-1",
      search: " Ana ",
    });
    expect(result).toEqual([recipient]);
    expect(db.clipperApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        where: {
          campaignId: "campaign-1",
          status: "APPROVED",
          clipperProfile: {
            verificationStatus: { not: "BANNED" },
            user: { role: "CLIPPER" },
            OR: [
              { fullName: { contains: "Ana", mode: "insensitive" } },
              { artisticName: { contains: "Ana", mode: "insensitive" } },
              { user: { email: { contains: "Ana", mode: "insensitive" } } },
            ],
          },
        },
      }),
    );
  });

  it.each(["clipper-1", "clipper-2"])(
    "limita a consulta aos avisos gerais e aos direcionamentos do próprio %s",
    async (clipperProfileId) => {
      const { api, db } = setup("CLIPPER");
      db.clipperProfile.findUnique.mockResolvedValue({
        id: clipperProfileId,
        verificationStatus: "VERIFIED",
        user: { role: "CLIPPER" },
      });
      await api.listForClipper({ slug: "competicao" });
      expect(db.competitionAnnouncement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: "campaign-1",
            category: undefined,
            AND: [
              {
                OR: [
                  {
                    category: { not: "GUIDANCE" },
                    recipientClipperProfileId: null,
                  },
                  {
                    category: "GUIDANCE",
                    recipientClipperProfileId: clipperProfileId,
                  },
                ],
              },
            ],
          },
        }),
      );
    },
  );

  it("mantém a restrição ao filtrar direcionamentos e ao paginar", async () => {
    const { api, db } = setup("CLIPPER");
    const cursor = { id: post.id, createdAt: post.createdAt };
    await api.listForClipper({
      slug: "competicao",
      category: "GUIDANCE",
      cursor,
    });
    expect(db.competitionAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: "campaign-1",
          category: "GUIDANCE",
          ...clipperVisibility,
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        },
      }),
    );
  });

  it("não aceita que o clipador informe o id de outro destinatário na consulta", async () => {
    const { api, db } = setup("CLIPPER");
    await expect(
      api.listForClipper({
        slug: "competicao",
        recipientClipperProfileId: "someone-else",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.competitionAnnouncement.findMany).not.toHaveBeenCalled();
  });

  it("retorna ao admin o destinatário para permitir a edição de um direcionamento", async () => {
    const { api, db } = setup();
    await api.listAdmin({ campaignId: "campaign-1" });
    expect(db.competitionAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          recipientClipperProfileId: true,
          recipient: {
            select: {
              id: true,
              fullName: true,
              artisticName: true,
              user: { select: { email: true } },
            },
          },
        }),
      }),
    );
  });
});
