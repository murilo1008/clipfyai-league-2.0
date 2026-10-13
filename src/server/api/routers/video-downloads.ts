import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  privateProcedure,
} from "@/server/api/trpc";
import {
  enqueuePendingVideoDownloads,
  enqueueVideoDownload,
} from "@/server/video-downloads";

// Cliente Prisma sem os métodos de transação — cobre o `ctx.db` do tRPC
type DbClient = Prisma.TransactionClient;

const platformSchema = z
  .enum(["ALL", "INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"])
  .default("ALL");

const sortSchema = z
  .enum(["newest", "views", "likes", "comments"])
  .default("views");

const postsInput = z.object({
  campaignId: z.string(),
  platform: platformSchema,
  sortBy: sortSchema,
  minViews: z.coerce.number().int().min(0).optional(),
  minLikes: z.coerce.number().int().min(0).optional(),
  minComments: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const downloadsInput = z.object({
  campaignId: z.string(),
  status: z
    .enum(["ALL", "QUEUED", "PROCESSING", "SUCCEEDED", "FAILED"])
    .default("ALL"),
  limit: z.number().int().min(1).max(100).default(50),
});

const statusesInput = z.object({
  campaignId: z.string(),
  // Só os itens em andamento que a tela está mostrando (lista de até 100).
  clipPostIds: z.array(z.string()).min(1).max(100),
});

const campaignSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  downloadVideos: true,
} satisfies Prisma.CampaignSelect;

type CampaignPayload = Prisma.CampaignGetPayload<{
  select: typeof campaignSelect;
}>;

/**
 * Mesmo `_count` de antes (posts e downloads por competição), mas em groupBy
 * restrito às competições listadas: o `_count` de relação no findMany agrega
 * as tabelas filhas inteiras (ClipPost tem centenas de milhares de linhas).
 */
async function withCampaignCounts(db: DbClient, campaigns: CampaignPayload[]) {
  const ids = campaigns.map((campaign) => campaign.id);
  if (ids.length === 0) return [];

  const [clipPosts, bucketVideos] = await Promise.all([
    db.clipPost.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids } },
      _count: { _all: true },
    }),
    db.clipPostBucketVideo.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const postsByCampaign = new Map(
    clipPosts.map((row) => [row.campaignId, row._count._all]),
  );
  const downloadsByCampaign = new Map(
    bucketVideos.map((row) => [row.campaignId, row._count._all]),
  );

  return campaigns.map((campaign) => ({
    ...campaign,
    _count: {
      clipPosts: postsByCampaign.get(campaign.id) ?? 0,
      bucketVideos: downloadsByCampaign.get(campaign.id) ?? 0,
    },
  }));
}

const postSelect = {
  id: true,
  campaignId: true,
  platform: true,
  submittedUrl: true,
  username: true,
  caption: true,
  thumbnailUrl: true,
  views: true,
  likes: true,
  comments: true,
  shares: true,
  status: true,
  postedAt: true,
  createdAt: true,
  bucketVideo: {
    select: {
      id: true,
      status: true,
      publicUrl: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ClipPostSelect;

type PostPayload = Prisma.ClipPostGetPayload<{ select: typeof postSelect }>;

const bucketVideoSelect = {
  id: true,
  status: true,
  publicUrl: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  clipPost: {
    select: {
      id: true,
      platform: true,
      status: true,
      username: true,
      thumbnailUrl: true,
      submittedUrl: true,
      views: true,
      likes: true,
      comments: true,
    },
  },
} satisfies Prisma.ClipPostBucketVideoSelect;

type BucketVideoPayload = Prisma.ClipPostBucketVideoGetPayload<{
  select: typeof bucketVideoSelect;
}>;

function postWhere(
  input: z.infer<typeof postsInput>,
): Prisma.ClipPostWhereInput {
  return {
    campaignId: input.campaignId,
    status: "ELIGIBLE",
    ...(input.platform !== "ALL" ? { platform: input.platform } : {}),
    ...(input.minViews != null
      ? { views: { gte: BigInt(input.minViews) } }
      : {}),
    ...(input.minLikes != null ? { likes: { gte: input.minLikes } } : {}),
    ...(input.minComments != null
      ? { comments: { gte: input.minComments } }
      : {}),
    ...(input.search
      ? {
          OR: [
            { username: { contains: input.search, mode: "insensitive" } },
            { caption: { contains: input.search, mode: "insensitive" } },
            { submittedUrl: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function postOrderBy(
  sortBy: z.infer<typeof sortSchema>,
): Prisma.ClipPostOrderByWithRelationInput {
  if (sortBy === "likes") return { likes: "desc" };
  if (sortBy === "comments") return { comments: "desc" };
  if (sortBy === "newest") return { createdAt: "desc" };
  return { views: "desc" };
}

// `views` é BigInt no Prisma; o client espera number
function serializePost(post: PostPayload) {
  return { ...post, views: Number(post.views) };
}

function serializeDownload(item: BucketVideoPayload) {
  return {
    ...item,
    clipPost: { ...item.clipPost, views: Number(item.clipPost.views) },
  };
}

function selectPosts(db: DbClient, input: z.infer<typeof postsInput>) {
  return db.clipPost.findMany({
    where: postWhere(input),
    orderBy: postOrderBy(input.sortBy),
    take: input.limit,
    select: postSelect,
  });
}

/**
 * Status atual dos downloads em andamento (polling leve da tela). Filtra pela
 * competição do post (a mesma das listas): o `campaignId` do download não
 * acompanha um post movido de competição pelo admin.
 */
function selectStatuses(db: DbClient, input: z.infer<typeof statusesInput>) {
  return db.clipPostBucketVideo.findMany({
    where: {
      clipPostId: { in: input.clipPostIds },
      clipPost: { campaignId: input.campaignId },
    },
    select: { clipPostId: true, status: true },
  });
}

function selectDownloads(
  db: DbClient,
  where: Prisma.ClipPostBucketVideoWhereInput,
  limit: number,
) {
  return db.clipPostBucketVideo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: bucketVideoSelect,
  });
}

/**
 * O League é chamado por HTTP interno; sem isso o erro chegaria ao client como
 * INTERNAL_SERVER_ERROR genérico (o tRPC esconde a mensagem em produção).
 */
async function callLeague<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        error instanceof Error
          ? error.message
          : "Falha ao comunicar com o serviço de downloads.",
      cause: error,
    });
  }
}

async function assertClientCanViewCampaign(
  db: DbClient,
  userId: string,
  campaignId: string,
) {
  const campaign = await db.campaign.findFirst({
    where: {
      id: campaignId,
      downloadVideos: true,
      clientId: userId,
    },
    select: { id: true },
  });

  if (!campaign) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Esta competição não está disponível para downloads neste acesso.",
    });
  }
}

async function assertClientCanEnqueuePost(
  db: DbClient,
  userId: string,
  clipPostId: string,
) {
  const post = await db.clipPost.findFirst({
    where: {
      id: clipPostId,
      status: "ELIGIBLE",
      campaign: {
        downloadVideos: true,
        clientId: userId,
      },
    },
    select: { id: true },
  });

  if (!post) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este vídeo não está disponível para download neste acesso.",
    });
  }
}

export const videoDownloadsRouter = createTRPCRouter({
  admin: createTRPCRouter({
    campaigns: adminProcedure
      .input(
        z
          .object({
            downloadStatus: z
              .enum(["ALL", "ENABLED", "DISABLED"])
              .default("ALL"),
            status: z
              .enum([
                "DRAFT",
                "SCHEDULED",
                "ACTIVE",
                "PAUSED",
                "COMPLETED",
                "ARCHIVED",
              ])
              .optional(),
          })
          .default({}),
      )
      .query(async ({ ctx, input }) => {
        const campaigns = await ctx.db.campaign.findMany({
          where: {
            ...(input.downloadStatus === "ENABLED"
              ? { downloadVideos: true }
              : {}),
            ...(input.downloadStatus === "DISABLED"
              ? { downloadVideos: false }
              : {}),
            ...(input.status ? { status: input.status } : {}),
          },
          select: campaignSelect,
          orderBy: { createdAt: "desc" },
        });
        return withCampaignCounts(ctx.db, campaigns);
      }),

    setCampaignEnabled: adminProcedure
      .input(z.object({ campaignId: z.string(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.campaign.update({
          where: { id: input.campaignId },
          data: { downloadVideos: input.enabled },
          select: { id: true, downloadVideos: true },
        });
      }),

    posts: adminProcedure.input(postsInput).query(async ({ ctx, input }) => {
      const posts = await selectPosts(ctx.db, input);
      return posts.map(serializePost);
    }),

    statuses: adminProcedure
      .input(statusesInput)
      .query(async ({ ctx, input }) => selectStatuses(ctx.db, input)),

    downloads: adminProcedure
      .input(downloadsInput)
      .query(async ({ ctx, input }) => {
        const items = await selectDownloads(
          ctx.db,
          {
            campaignId: input.campaignId,
            ...(input.status !== "ALL" ? { status: input.status } : {}),
            clipPost: { status: "ELIGIBLE" },
          },
          input.limit,
        );
        return items.map(serializeDownload);
      }),

    enqueue: adminProcedure
      .input(z.object({ clipPostId: z.string() }))
      .mutation(async ({ input }) => {
        return callLeague(() => enqueueVideoDownload(input.clipPostId));
      }),

    processQueue: adminProcedure.mutation(async () => {
      const result = await callLeague(() => enqueuePendingVideoDownloads());
      return { processed: result.enqueued };
    }),
  }),

  client: createTRPCRouter({
    campaigns: privateProcedure.query(async ({ ctx }) => {
      const campaigns = await ctx.db.campaign.findMany({
        where: {
          clientId: ctx.userId,
          downloadVideos: true,
          status: { not: "ARCHIVED" },
        },
        select: campaignSelect,
        orderBy: { createdAt: "desc" },
      });
      return withCampaignCounts(ctx.db, campaigns);
    }),

    posts: privateProcedure.input(postsInput).query(async ({ ctx, input }) => {
      await assertClientCanViewCampaign(ctx.db, ctx.userId, input.campaignId);
      const posts = await selectPosts(ctx.db, input);
      return posts.map(serializePost);
    }),

    statuses: privateProcedure
      .input(statusesInput)
      .query(async ({ ctx, input }) => {
        await assertClientCanViewCampaign(
          ctx.db,
          ctx.userId,
          input.campaignId,
        );
        return selectStatuses(ctx.db, input);
      }),

    downloads: privateProcedure
      .input(downloadsInput)
      .query(async ({ ctx, input }) => {
        await assertClientCanViewCampaign(ctx.db, ctx.userId, input.campaignId);
        // O cliente só enxerga downloads já concluídos
        const items = await selectDownloads(
          ctx.db,
          {
            campaignId: input.campaignId,
            status: "SUCCEEDED",
            clipPost: { status: "ELIGIBLE" },
          },
          input.limit,
        );
        return items.map(serializeDownload);
      }),

    enqueue: privateProcedure
      .input(z.object({ clipPostId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await assertClientCanEnqueuePost(ctx.db, ctx.userId, input.clipPostId);
        return callLeague(() => enqueueVideoDownload(input.clipPostId));
      }),
  }),
});
