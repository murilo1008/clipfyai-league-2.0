import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  DISCIPLINE_OBSERVATION_REASON,
} from "@/lib/clipper-discipline/constants";
import {
  effectiveWarningStatus,
  MANUAL_SANCTION_TYPES,
} from "@/lib/clipper-discipline/levels";
import { disciplineSettingsSchema } from "@/lib/clipper-discipline/settings";
import {
  adminProcedure,
  createTRPCRouter,
  privateProcedure,
} from "@/server/api/trpc";
import { getClipperRestrictions } from "@/server/clipper-discipline/restrictions";
import {
  getDisciplineSettings,
  updateDisciplineSettings,
} from "@/server/clipper-discipline/settings";
import {
  activeWarningWhere,
  applyClipperWarning,
  applyManualSanction,
  decideBanReview,
  isDisciplineEnabled,
  revokeClipperWarning,
  revokeSanction,
  reviewObservationPost,
  submitWarningDefense,
  suggestLevelForClipper,
} from "@/server/clipper-discipline/warnings";

const infractionTypeSchema = z.enum(["LIGHT", "MEDIUM", "SEVERE"]);
const warningStatusSchema = z.enum(["ACTIVE", "EXPIRED", "REVOKED"]);

function statusWhere(
  status: z.infer<typeof warningStatusSchema>,
  now: Date,
): Prisma.ClipperWarningWhereInput {
  if (status === "ACTIVE") return { status: "ACTIVE", expiresAt: { gt: now } };
  if (status === "EXPIRED") {
    return {
      OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lte: now } }],
    };
  }
  return { status: "REVOKED" };
}

const sanctionSelect = {
  id: true,
  type: true,
  campaignId: true,
  clipPostId: true,
  scoreMultiplierBps: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  revokedAt: true,
  revokeReason: true,
  createdAt: true,
  metadata: true,
  campaign: { select: { name: true } },
} satisfies Prisma.ClipperSanctionSelect;

type SanctionRow = Prisma.ClipperSanctionGetPayload<{ select: typeof sanctionSelect }>;

/** Sem o metadata interno (ids para revogar); só o dia da zeragem de pontos ou do pódio. */
function toSanctionView({ metadata, ...sanction }: SanctionRow) {
  const rankingDate = (metadata as { rankingDate?: unknown } | null)?.rankingDate;
  return {
    ...sanction,
    rankingDate: typeof rankingDate === "string" ? rankingDate : null,
  };
}

const warningSelect = {
  id: true,
  clipperProfileId: true,
  campaignId: true,
  clipPostId: true,
  videoUrl: true,
  infractionType: true,
  level: true,
  suggestedLevel: true,
  reason: true,
  status: true,
  appliedById: true,
  appliedAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedById: true,
  revokeReason: true,
  defenseText: true,
  defenseSubmittedAt: true,
  banReviewStatus: true,
  banReviewedAt: true,
  campaign: { select: { id: true, name: true, slug: true } },
  clipperProfile: {
    select: {
      id: true,
      fullName: true,
      artisticName: true,
      user: { select: { email: true, imageUrl: true } },
    },
  },
  sanctions: { select: sanctionSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ClipperWarningSelect;

type WarningRow = Prisma.ClipperWarningGetPayload<{ select: typeof warningSelect }>;

async function withAdminNames<T extends WarningRow>(
  db: Prisma.TransactionClient,
  rows: T[],
  now: Date,
) {
  const adminIds = [
    ...new Set(
      rows.flatMap((row) => [row.appliedById, row.revokedById].filter(Boolean)),
    ),
  ] as string[];
  const admins =
    adminIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const nameById = new Map(admins.map((admin) => [admin.id, admin.name || admin.email]));
  return rows.map((row) => ({
    ...row,
    sanctions: row.sanctions.map(toSanctionView),
    effectiveStatus: effectiveWarningStatus(row, now),
    appliedByName: nameById.get(row.appliedById) ?? null,
    revokedByName: row.revokedById ? (nameById.get(row.revokedById) ?? null) : null,
  }));
}

export const clipperDisciplineRouter = createTRPCRouter({
  // ------------------------------------------------------------------ admin
  status: adminProcedure.query(() => ({ enabled: isDisciplineEnabled() })),

  getSettings: adminProcedure.query(({ ctx }) => getDisciplineSettings(ctx.db)),

  updateSettings: adminProcedure
    .input(disciplineSettingsSchema)
    .mutation(({ ctx, input }) =>
      updateDisciplineSettings(ctx.db, input, ctx.userId),
    ),

  /** Contexto do formulário de aplicar: sugestão, competições e restrições do clipador. */
  applyContext: adminProcedure
    .input(z.object({ clipperProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const [suggestion, applications, restrictions, settings, activeWarnings] =
        await Promise.all([
          suggestLevelForClipper(ctx.db, input.clipperProfileId, now),
          ctx.db.clipperApplication.findMany({
            where: { clipperProfileId: input.clipperProfileId },
            select: {
              status: true,
              campaign: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
          getClipperRestrictions(ctx.db, input.clipperProfileId, now),
          getDisciplineSettings(ctx.db),
          ctx.db.clipperWarning.findMany({
            where: activeWarningWhere(input.clipperProfileId, now),
            select: { id: true, infractionType: true, level: true, appliedAt: true, expiresAt: true },
            orderBy: { appliedAt: "desc" },
          }),
        ]);
      return {
        enabled: isDisciplineEnabled(),
        ...suggestion,
        activeWarnings,
        settings,
        restrictions,
        competitions: applications.map((application) => ({
          id: application.campaign.id,
          name: application.campaign.name,
          campaignStatus: application.campaign.status,
          applicationStatus: application.status,
        })),
      };
    }),

  /** Vídeos do clipador numa competição, para escolher o vídeo da infração. */
  clipperPosts: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        campaignId: z.string(),
        search: z.string().trim().max(200).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db.clipPost.findMany({
        where: {
          campaignId: input.campaignId,
          application: { clipperProfileId: input.clipperProfileId },
          ...(input.search
            ? { submittedUrl: { contains: input.search, mode: "insensitive" } }
            : {}),
        },
        select: {
          id: true,
          submittedUrl: true,
          platform: true,
          status: true,
          postedAt: true,
          views: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ),

  applyWarning: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        infractionType: infractionTypeSchema,
        level: z.number().int().min(0).max(4).nullable(),
        campaignId: z.string().nullish(),
        clipPostId: z.string().nullish(),
        videoUrl: z.string().trim().max(2000).nullish(),
        reason: z.string().trim().min(3).max(2000),
        confirmBan: z.boolean().optional(),
        podiumRankingDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      applyClipperWarning(ctx.db, { ...input, actorUserId: ctx.userId }),
    ),

  revoke: adminProcedure
    .input(
      z.object({
        warningId: z.string(),
        reason: z.string().trim().min(3).max(2000),
        restorePrizes: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) =>
      revokeClipperWarning(ctx.db, { ...input, actorUserId: ctx.userId }),
    ),

  applySanction: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        type: z.enum(MANUAL_SANCTION_TYPES),
        durationDays: z.number().int().min(1).max(365).nullish(),
        scoreMultiplierBps: z.number().int().min(100).max(9999).nullish(),
        campaignId: z.string().nullish(),
        rankingDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
        reason: z.string().trim().min(3).max(2000),
      }),
    )
    .mutation(({ ctx, input }) =>
      applyManualSanction(ctx.db, { ...input, actorUserId: ctx.userId }),
    ),

  revokeSanction: adminProcedure
    .input(
      z.object({
        sanctionId: z.string(),
        reason: z.string().trim().min(3).max(2000),
        restorePrizes: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      revokeSanction(ctx.db, { ...input, actorUserId: ctx.userId }),
    ),

  list: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(200).optional(),
        campaignId: z.string().optional(),
        infractionType: infractionTypeSchema.optional(),
        status: warningStatusSchema.optional(),
        clipperProfileId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const and: Prisma.ClipperWarningWhereInput[] = [];
      if (input.campaignId) and.push({ campaignId: input.campaignId });
      if (input.infractionType) and.push({ infractionType: input.infractionType });
      if (input.status) and.push(statusWhere(input.status, now));
      if (input.clipperProfileId) and.push({ clipperProfileId: input.clipperProfileId });
      if (input.search) {
        and.push({
          clipperProfile: {
            OR: [
              { fullName: { contains: input.search, mode: "insensitive" } },
              { artisticName: { contains: input.search, mode: "insensitive" } },
              { user: { email: { contains: input.search, mode: "insensitive" } } },
            ],
          },
        });
      }
      const where: Prisma.ClipperWarningWhereInput = and.length > 0 ? { AND: and } : {};
      const [total, rows, counts] = await Promise.all([
        ctx.db.clipperWarning.count({ where }),
        ctx.db.clipperWarning.findMany({
          where,
          select: warningSelect,
          orderBy: { appliedAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        Promise.all([
          ctx.db.clipperWarning.count({ where: statusWhere("ACTIVE", now) }),
          ctx.db.clipperWarning.count({
            where: { infractionType: "SEVERE", banReviewStatus: "PENDING", status: { not: "REVOKED" } },
          }),
          ctx.db.clipPost.count({
            where: { status: "INELIGIBLE", ineligibilityReason: DISCIPLINE_OBSERVATION_REASON },
          }),
        ]),
      ]);
      return {
        total,
        items: await withAdminNames(ctx.db, rows, now),
        stats: {
          active: counts[0],
          pendingBanReviews: counts[1],
          pendingObservationReviews: counts[2],
        },
      };
    }),

  historyByClipper: adminProcedure
    .input(z.object({ clipperProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const [warnings, standalone, restrictions, suggestion] = await Promise.all([
        ctx.db.clipperWarning.findMany({
          where: { clipperProfileId: input.clipperProfileId },
          select: warningSelect,
          orderBy: { appliedAt: "desc" },
        }),
        ctx.db.clipperSanction.findMany({
          where: { clipperProfileId: input.clipperProfileId, warningId: null },
          select: sanctionSelect,
          orderBy: { createdAt: "desc" },
        }),
        getClipperRestrictions(ctx.db, input.clipperProfileId, now),
        suggestLevelForClipper(ctx.db, input.clipperProfileId, now),
      ]);
      return {
        enabled: isDisciplineEnabled(),
        warnings: await withAdminNames(ctx.db, warnings, now),
        sanctions: standalone.map(toSanctionView),
        restrictions,
        ...suggestion,
      };
    }),

  campaignOptions: adminProcedure.query(({ ctx }) =>
    ctx.db.campaign.findMany({
      where: { clipperWarnings: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ),

  observationQueue: adminProcedure.query(({ ctx }) =>
    ctx.db.clipPost.findMany({
      where: { status: "INELIGIBLE", ineligibilityReason: DISCIPLINE_OBSERVATION_REASON },
      select: {
        id: true,
        submittedUrl: true,
        platform: true,
        postedAt: true,
        createdAt: true,
        views: true,
        likes: true,
        comments: true,
        campaign: { select: { id: true, name: true } },
        application: {
          select: {
            clipperProfile: {
              select: { id: true, fullName: true, artisticName: true },
            },
          },
        },
      },
      orderBy: [{ postedAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
  ),

  reviewObservationPost: adminProcedure
    .input(z.object({ clipPostId: z.string(), approve: z.boolean() }))
    .mutation(({ ctx, input }) =>
      reviewObservationPost(ctx.db, { ...input, actorUserId: ctx.userId }),
    ),

  banReviewQueue: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.clipperWarning.findMany({
      where: {
        infractionType: "SEVERE",
        banReviewStatus: "PENDING",
        status: { not: "REVOKED" },
      },
      select: warningSelect,
      orderBy: { appliedAt: "asc" },
    });
    return withAdminNames(ctx.db, rows, new Date());
  }),

  decideBanReview: adminProcedure
    .input(z.object({ warningId: z.string(), ban: z.boolean() }))
    .mutation(({ ctx, input }) =>
      decideBanReview(ctx.db, { ...input, actorUserId: ctx.userId }),
    ),

  // --------------------------------------------------------------- clipador
  /** Estado para o banner e o envio de posts (consultado em várias telas). */
  myStatus: privateProcedure.query(async ({ ctx }) => {
    const clipperProfileId = await ctx.getClipperProfileId();
    if (!clipperProfileId) return null;
    const now = new Date();
    const [restrictions, activeWarnings] = await Promise.all([
      getClipperRestrictions(ctx.db, clipperProfileId, now),
      ctx.db.clipperWarning.count({
        where: activeWarningWhere(clipperProfileId, now),
      }),
    ]);
    return { ...restrictions, activeWarnings };
  }),

  myWarnings: privateProcedure.query(async ({ ctx }) => {
    const clipperProfileId = await ctx.getClipperProfileId();
    if (!clipperProfileId) return { warnings: [], sanctions: [] };
    const now = new Date();
    const [warnings, sanctions] = await Promise.all([
      ctx.db.clipperWarning.findMany({
        where: { clipperProfileId },
        select: {
          id: true,
          infractionType: true,
          level: true,
          reason: true,
          videoUrl: true,
          status: true,
          appliedAt: true,
          expiresAt: true,
          revokedAt: true,
          revokeReason: true,
          defenseText: true,
          defenseSubmittedAt: true,
          campaign: { select: { name: true } },
          sanctions: { select: sanctionSelect, orderBy: { createdAt: "asc" } },
        },
        orderBy: { appliedAt: "desc" },
      }),
      ctx.db.clipperSanction.findMany({
        where: { clipperProfileId, warningId: null },
        select: sanctionSelect,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      warnings: warnings.map((warning) => ({
        ...warning,
        sanctions: warning.sanctions.map(toSanctionView),
        effectiveStatus: effectiveWarningStatus(warning, now),
      })),
      sanctions: sanctions.map(toSanctionView),
    };
  }),

  submitDefense: privateProcedure
    .input(z.object({ warningId: z.string(), text: z.string().max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const clipperProfileId = await ctx.getClipperProfileId();
      if (!clipperProfileId) {
        throw new Error("Acesso restrito aos clipadores.");
      }
      return submitWarningDefense(ctx.db, {
        warningId: input.warningId,
        clipperProfileId,
        text: input.text,
      });
    }),
});
