import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  describeSandboxIssue,
  sandboxDataSchema,
  type SandboxData,
} from "@/lib/competition-sandbox";
import { adminRouter } from "@/server/api/routers/admin";
import {
  adminProcedure,
  createCallerFactory,
  createTRPCRouter,
  type createTRPCContext,
} from "@/server/api/trpc";
import { buildSandboxSnapshot } from "@/server/competition-sandbox-snapshot";

/*
 * Sandbox de competição: cópias editáveis dos dados de uma competição.
 * Só lê da competição real (pelas mesmas queries da página do admin) e só
 * escreve em CompetitionSandbox.
 */

const createAdminCaller = createCallerFactory(adminRouter);

const nameSchema = z.string().trim().min(1, "Informe um nome").max(200);

const listSelect = {
  id: true,
  name: true,
  sourceCampaignId: true,
  sourceCampaignName: true,
  importedAt: true,
  createdAt: true,
  updatedAt: true,
  sourceCampaign: { select: { slug: true, name: true } },
  createdBy: { select: { name: true, email: true } },
} satisfies Prisma.CompetitionSandboxSelect;

type RouterContext = Awaited<ReturnType<typeof createTRPCContext>>;

/** Snapshot da competição como a página do admin a mostra agora. */
async function importCampaign(ctx: RouterContext, campaignId: string) {
  const campaign = await ctx.db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, slug: true },
  });
  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Competição não encontrada",
    });
  }

  const admin = createAdminCaller(ctx);
  const [details, charts] = await Promise.all([
    admin.getCompetitionDetailsAdmin({ slug: campaign.slug }),
    // Sem gráficos a cópia ainda serve: o admin pode preenchê-los à mão.
    admin.getCompetitionChartsAdmin({ slug: campaign.slug }).catch((error) => {
      console.error("[sandbox] gráficos não importados:", error);
      return null;
    }),
  ]);

  const parsed = sandboxDataSchema.safeParse(
    buildSandboxSnapshot({ details, charts }),
  );
  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Não foi possível importar os dados (${describeSandboxIssue(parsed.error)})`,
    });
  }
  return { campaign, data: parsed.data };
}

function readData(raw: Prisma.JsonValue): SandboxData {
  const parsed = sandboxDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Dados do sandbox inválidos (${describeSandboxIssue(parsed.error)})`,
    });
  }
  return parsed.data;
}

/**
 * Sandbox completo para o editor, com a thumbnail atual de cada post de
 * origem (a do snapshot ficaria expirada no dia seguinte).
 */
async function loadSandbox(db: PrismaClient, id: string) {
  const sandbox = await db.competitionSandbox.findUnique({
    where: { id },
    select: { ...listSelect, data: true },
  });
  if (!sandbox) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Sandbox não encontrado",
    });
  }
  const data = readData(sandbox.data);
  const sourcePostIds = [
    ...new Set(data.topPosts.map((post) => post.sourcePostId).filter(Boolean)),
  ];
  const posts =
    sourcePostIds.length > 0
      ? await db.clipPost.findMany({
          where: { id: { in: sourcePostIds } },
          select: { id: true, thumbnailUrl: true },
        })
      : [];
  const postThumbnails: Record<string, string> = {};
  for (const post of posts) {
    if (post.thumbnailUrl) postThumbnails[post.id] = post.thumbnailUrl;
  }
  return { ...sandbox, data, postThumbnails };
}

async function requireSandbox(db: PrismaClient, id: string) {
  const sandbox = await db.competitionSandbox.findUnique({ where: { id } });
  if (!sandbox) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Sandbox não encontrado",
    });
  }
  return sandbox;
}

export const competitionSandboxRouter = createTRPCRouter({
  /** Competições que podem ser importadas. */
  campaigns: adminProcedure.query(({ ctx }) =>
    ctx.db.campaign.findMany({
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ),

  list: adminProcedure.query(({ ctx }) =>
    ctx.db.competitionSandbox.findMany({
      select: listSelect,
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ),

  get: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ ctx, input }) => loadSandbox(ctx.db, input.id)),

  create: adminProcedure
    .input(
      z.object({ campaignId: z.string().min(1), name: nameSchema.optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      const { campaign, data } = await importCampaign(ctx, input.campaignId);
      return ctx.db.competitionSandbox.create({
        data: {
          name: input.name ?? `${campaign.name} (sandbox)`.slice(0, 200),
          sourceCampaignId: campaign.id,
          sourceCampaignName: campaign.name.slice(0, 200),
          data,
          createdById: ctx.userId,
        },
        select: { id: true },
      });
    }),

  /**
   * Salva as edições. `expectedUpdatedAt` evita sobrescrever o que outro
   * admin salvou depois que esta versão foi carregada.
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: nameSchema,
        data: sandboxDataSchema,
        expectedUpdatedAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // A versão nova sai do mesmo UPDATE que confere a anterior: ler o
      // updatedAt depois poderia devolver o de outro admin que salvou no meio.
      const updatedAt = new Date();
      const result = await ctx.db.competitionSandbox.updateMany({
        where: { id: input.id, updatedAt: input.expectedUpdatedAt },
        data: { name: input.name, data: input.data, updatedAt },
      });
      if (result.count === 0) {
        await requireSandbox(ctx.db, input.id);
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Este sandbox foi alterado em outra aba ou por outro admin. Recarregue a página para ver a versão atual.",
        });
      }
      return { updatedAt };
    }),

  /** Descarta as edições e importa de novo os dados reais da origem. */
  reimport: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sandbox = await requireSandbox(ctx.db, input.id);
      if (!sandbox.sourceCampaignId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A competição de origem foi excluída",
        });
      }
      const { campaign, data } = await importCampaign(
        ctx,
        sandbox.sourceCampaignId,
      );
      await ctx.db.competitionSandbox.update({
        where: { id: sandbox.id },
        data: {
          data,
          sourceCampaignName: campaign.name.slice(0, 200),
          importedAt: new Date(),
        },
        select: { id: true },
      });
      return loadSandbox(ctx.db, sandbox.id);
    }),

  duplicate: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sandbox = await requireSandbox(ctx.db, input.id);
      return ctx.db.competitionSandbox.create({
        data: {
          name: `${sandbox.name} (cópia)`.slice(0, 200),
          sourceCampaignId: sandbox.sourceCampaignId,
          sourceCampaignName: sandbox.sourceCampaignName,
          data: readData(sandbox.data),
          importedAt: sandbox.importedAt,
          createdById: ctx.userId,
        },
        select: { id: true },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.competitionSandbox.deleteMany({
        where: { id: input.id },
      });
      return { deleted: result.count > 0 };
    }),
});
