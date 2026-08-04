import { createTRPCRouter, adminProcedure, publicProcedure, privateProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import OpenAI from "openai";
import { UTApi, UTFile } from "uploadthing/server";
import { env } from "@/env";
import { calculateEngagementRate } from "@/lib/ranking-helpers";

export const blogRouter = createTRPCRouter({
  // ============================================================================
  // CATEGORIAS
  // ============================================================================

  // Listar todas as categorias com contagens de posts
  getCategories: adminProcedure.query(async ({ ctx }) => {
    try {
      const categories = await ctx.db.blogCategory.findMany({
        orderBy: { order: "asc" },
        include: {
          _count: {
            select: { posts: true },
          },
          posts: {
            select: {
              id: true,
              status: true,
              viewsCount: true,
              likesCount: true,
              commentsCount: true,
            },
          },
        },
      });

      return categories.map((cat) => {
        const publishedPosts = cat.posts.filter((p) => p.status === "PUBLISHED").length;
        const draftPosts = cat.posts.filter((p) => p.status === "DRAFT").length;
        const totalViews = cat.posts.reduce((sum, p) => sum + p.viewsCount, 0);
        const totalLikes = cat.posts.reduce((sum, p) => sum + p.likesCount, 0);
        const totalComments = cat.posts.reduce((sum, p) => sum + p.commentsCount, 0);

        return {
          id: cat.id,
          title: cat.title,
          slug: cat.slug,
          description: cat.description,
          coverImageUrl: cat.coverImageUrl,
          color: cat.color,
          order: cat.order,
          isActive: cat.isActive,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
          postsCount: cat._count.posts,
          publishedPosts,
          draftPosts,
          totalViews,
          totalLikes,
          totalComments,
        };
      });
    } catch (error: any) {
      console.error("Erro ao buscar categorias:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar categorias",
      });
    }
  }),

  // Estatísticas gerais das categorias
  getCategoryStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [
        totalCategories,
        activeCategories,
        totalPosts,
        publishedPosts,
      ] = await Promise.all([
        ctx.db.blogCategory.count(),
        ctx.db.blogCategory.count({ where: { isActive: true } }),
        ctx.db.blogPost.count(),
        ctx.db.blogPost.count({ where: { status: "PUBLISHED" } }),
      ]);

      // Categoria mais popular (com mais posts publicados)
      const mostPopular = await ctx.db.blogCategory.findFirst({
        orderBy: {
          posts: { _count: "desc" },
        },
        include: {
          _count: { select: { posts: true } },
        },
      });

      // Posts sem categoria
      const uncategorizedPosts = await ctx.db.blogPost.count({
        where: { categoryId: null },
      });

      // Total de views e likes de todas as categorias
      const aggregates = await ctx.db.blogPost.aggregate({
        _sum: {
          viewsCount: true,
          likesCount: true,
          commentsCount: true,
        },
      });

      return {
        totalCategories,
        activeCategories,
        inactiveCategories: totalCategories - activeCategories,
        totalPosts,
        publishedPosts,
        uncategorizedPosts,
        mostPopular: mostPopular
          ? { title: mostPopular.title, postsCount: mostPopular._count.posts, color: mostPopular.color }
          : null,
        totalViews: aggregates._sum.viewsCount || 0,
        totalLikes: aggregates._sum.likesCount || 0,
        totalComments: aggregates._sum.commentsCount || 0,
      };
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar estatísticas",
      });
    }
  }),

  // Criar categoria
  createCategory: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "Título é obrigatório"),
        description: z.string().optional(),
        coverImageUrl: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Gerar slug
        const baseSlug = input.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        let slug = baseSlug;
        let counter = 1;
        while (await ctx.db.blogCategory.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Buscar maior ordem atual
        const maxOrder = await ctx.db.blogCategory.aggregate({
          _max: { order: true },
        });
        const nextOrder = (maxOrder._max.order || 0) + 1;

        const category = await ctx.db.blogCategory.create({
          data: {
            title: input.title,
            slug,
            description: input.description || null,
            coverImageUrl: input.coverImageUrl || null,
            color: input.color || null,
            order: nextOrder,
            isActive: input.isActive,
          },
        });

        return category;
      } catch (error: any) {
        console.error("Erro ao criar categoria:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao criar categoria",
        });
      }
    }),

  // Atualizar categoria
  updateCategory: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        coverImageUrl: z.string().optional().nullable(),
        color: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
        order: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        // Se estiver atualizando o título, recalcular slug
        let slug: string | undefined;
        if (data.title) {
          const baseSlug = data.title
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

          slug = baseSlug;
          let counter = 1;
          while (true) {
            const existing = await ctx.db.blogCategory.findUnique({
              where: { slug },
            });
            if (!existing || existing.id === id) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
        }

        const category = await ctx.db.blogCategory.update({
          where: { id },
          data: {
            ...data,
            ...(slug ? { slug } : {}),
          },
        });

        return category;
      } catch (error: any) {
        console.error("Erro ao atualizar categoria:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar categoria",
        });
      }
    }),

  // Alternar status ativo/inativo
  toggleCategoryActive: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const category = await ctx.db.blogCategory.findUnique({
          where: { id: input.id },
        });

        if (!category) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Categoria não encontrada",
          });
        }

        const updated = await ctx.db.blogCategory.update({
          where: { id: input.id },
          data: { isActive: !category.isActive },
        });

        return updated;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("Erro ao alternar status:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao alternar status",
        });
      }
    }),

  // Deletar categoria
  deleteCategory: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verificar se há posts associados
        const postsCount = await ctx.db.blogPost.count({
          where: { categoryId: input.id },
        });

        if (postsCount > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Não é possível excluir: esta categoria possui ${postsCount} post(s) associado(s). Remova ou mova os posts primeiro.`,
          });
        }

        await ctx.db.blogCategory.delete({
          where: { id: input.id },
        });

        return { success: true };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("Erro ao excluir categoria:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao excluir categoria",
        });
      }
    }),

  // ============================================================================
  // POSTS
  // ============================================================================

  // Listar todos os posts com métricas e relações
  getPosts: adminProcedure.query(async ({ ctx }) => {
    try {
      const posts = await ctx.db.blogPost.findMany({
        orderBy: [
          { isPinned: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              imageUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              title: true,
              slug: true,
              color: true,
            },
          },
        },
      });

      return posts.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverImageUrl: post.coverImageUrl,
        tags: post.tags,
        status: post.status,
        publishedAt: post.publishedAt,
        scheduledAt: post.scheduledAt,
        isFeatured: post.isFeatured,
        isPinned: post.isPinned,
        viewsCount: post.viewsCount,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        sharesCount: post.sharesCount,
        readTimeMinutes: post.readTimeMinutes,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: post.author,
        category: post.category,
      }));
    } catch (error: any) {
      console.error("Erro ao buscar posts:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar posts",
      });
    }
  }),

  // Estatísticas gerais dos posts
  getPostsStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const last7Days = new Date(today.getTime() - 7 * 86400000);
      const last30Days = new Date(today.getTime() - 30 * 86400000);

      const [
        totalPosts,
        publishedPosts,
        draftPosts,
        scheduledPosts,
        archivedPosts,
        featuredPosts,
        pinnedPosts,
      ] = await Promise.all([
        ctx.db.blogPost.count(),
        ctx.db.blogPost.count({ where: { status: "PUBLISHED" } }),
        ctx.db.blogPost.count({ where: { status: "DRAFT" } }),
        ctx.db.blogPost.count({ where: { status: "SCHEDULED" } }),
        ctx.db.blogPost.count({ where: { status: "ARCHIVED" } }),
        ctx.db.blogPost.count({ where: { isFeatured: true } }),
        ctx.db.blogPost.count({ where: { isPinned: true } }),
      ]);

      const aggregates = await ctx.db.blogPost.aggregate({
        _sum: {
          viewsCount: true,
          likesCount: true,
          commentsCount: true,
          sharesCount: true,
        },
        _avg: {
          viewsCount: true,
          likesCount: true,
          readTimeMinutes: true,
        },
      });

      // Posts publicados nos últimos 7 e 30 dias
      const [publishedLast7, publishedLast30] = await Promise.all([
        ctx.db.blogPost.count({
          where: { status: "PUBLISHED", publishedAt: { gte: last7Days } },
        }),
        ctx.db.blogPost.count({
          where: { status: "PUBLISHED", publishedAt: { gte: last30Days } },
        }),
      ]);

      // Post mais visto
      const mostViewed = await ctx.db.blogPost.findFirst({
        orderBy: { viewsCount: "desc" },
        select: { title: true, viewsCount: true, slug: true },
      });

      // Post mais curtido
      const mostLiked = await ctx.db.blogPost.findFirst({
        orderBy: { likesCount: "desc" },
        select: { title: true, likesCount: true, slug: true },
      });

      return {
        totalPosts,
        publishedPosts,
        draftPosts,
        scheduledPosts,
        archivedPosts,
        featuredPosts,
        pinnedPosts,
        totalViews: aggregates._sum.viewsCount || 0,
        totalLikes: aggregates._sum.likesCount || 0,
        totalComments: aggregates._sum.commentsCount || 0,
        totalShares: aggregates._sum.sharesCount || 0,
        avgViews: Math.round(aggregates._avg.viewsCount || 0),
        avgLikes: Math.round(aggregates._avg.likesCount || 0),
        avgReadTime: Math.round(aggregates._avg.readTimeMinutes || 0),
        publishedLast7,
        publishedLast30,
        mostViewed,
        mostLiked,
      };
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas de posts:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar estatísticas de posts",
      });
    }
  }),

  // Analytics & Reports completo
  getReportsData: adminProcedure.query(async ({ ctx }) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const last7 = new Date(today.getTime() - 7 * 86400000);
      const last30 = new Date(today.getTime() - 30 * 86400000);
      const last90 = new Date(today.getTime() - 90 * 86400000);

      // --- Aggregate totals ---
      const aggregates = await ctx.db.blogPost.aggregate({
        _sum: { viewsCount: true, likesCount: true, commentsCount: true, sharesCount: true },
        _avg: { viewsCount: true, likesCount: true, commentsCount: true, readTimeMinutes: true },
        _count: true,
      });

      const publishedCount = await ctx.db.blogPost.count({ where: { status: "PUBLISHED" } });

      // --- Views by day (last 30 days) ---
      const viewsByDay: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = new Date(today.getTime() - i * 86400000);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const count = await ctx.db.blogPostView.count({
          where: { viewedAt: { gte: dayStart, lt: dayEnd } },
        });
        viewsByDay.push({
          date: dayStart.toISOString().split("T")[0]!,
          count,
        });
      }

      // --- Likes by day (last 30 days) ---
      const likesByDay: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = new Date(today.getTime() - i * 86400000);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const count = await ctx.db.blogPostLike.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        });
        likesByDay.push({
          date: dayStart.toISOString().split("T")[0]!,
          count,
        });
      }

      // --- Comments by day (last 30 days) ---
      const commentsByDay: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = new Date(today.getTime() - i * 86400000);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const count = await ctx.db.blogComment.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        });
        commentsByDay.push({
          date: dayStart.toISOString().split("T")[0]!,
          count,
        });
      }

      // --- Period comparisons ---
      const [viewsToday, viewsLast7, viewsLast30] = await Promise.all([
        ctx.db.blogPostView.count({ where: { viewedAt: { gte: today } } }),
        ctx.db.blogPostView.count({ where: { viewedAt: { gte: last7 } } }),
        ctx.db.blogPostView.count({ where: { viewedAt: { gte: last30 } } }),
      ]);

      const [likesToday, likesLast7, likesLast30] = await Promise.all([
        ctx.db.blogPostLike.count({ where: { createdAt: { gte: today } } }),
        ctx.db.blogPostLike.count({ where: { createdAt: { gte: last7 } } }),
        ctx.db.blogPostLike.count({ where: { createdAt: { gte: last30 } } }),
      ]);

      const [commentsToday, commentsLast7, commentsLast30] = await Promise.all([
        ctx.db.blogComment.count({ where: { createdAt: { gte: today } } }),
        ctx.db.blogComment.count({ where: { createdAt: { gte: last7 } } }),
        ctx.db.blogComment.count({ where: { createdAt: { gte: last30 } } }),
      ]);

      // --- Top 10 posts by views ---
      const topPostsByViews = await ctx.db.blogPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { viewsCount: "desc" },
        take: 10,
        select: {
          id: true, title: true, slug: true, coverImageUrl: true,
          viewsCount: true, likesCount: true, commentsCount: true, sharesCount: true,
          publishedAt: true, readTimeMinutes: true,
          category: { select: { title: true, color: true } },
        },
      });

      // --- Top 10 posts by likes ---
      const topPostsByLikes = await ctx.db.blogPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { likesCount: "desc" },
        take: 10,
        select: {
          id: true, title: true, slug: true,
          viewsCount: true, likesCount: true, commentsCount: true,
          category: { select: { title: true, color: true } },
        },
      });

      // --- Top 10 posts by comments ---
      const topPostsByComments = await ctx.db.blogPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { commentsCount: "desc" },
        take: 10,
        select: {
          id: true, title: true, slug: true,
          viewsCount: true, likesCount: true, commentsCount: true,
          category: { select: { title: true, color: true } },
        },
      });

      // --- Category performance ---
      const categories = await ctx.db.blogCategory.findMany({
        where: { isActive: true },
        include: {
          posts: {
            where: { status: "PUBLISHED" },
            select: {
              viewsCount: true, likesCount: true, commentsCount: true, sharesCount: true,
            },
          },
        },
        orderBy: { order: "asc" },
      });

      const categoryPerformance = categories.map((cat) => ({
        id: cat.id,
        title: cat.title,
        color: cat.color,
        postsCount: cat.posts.length,
        totalViews: cat.posts.reduce((s, p) => s + p.viewsCount, 0),
        totalLikes: cat.posts.reduce((s, p) => s + p.likesCount, 0),
        totalComments: cat.posts.reduce((s, p) => s + p.commentsCount, 0),
        totalShares: cat.posts.reduce((s, p) => s + p.sharesCount, 0),
      }));

      // --- Device breakdown ---
      const devices = await ctx.db.blogPostView.groupBy({
        by: ["device"],
        _count: { id: true },
        where: { device: { not: null } },
        orderBy: { _count: { id: "desc" } },
      });

      // --- Browser breakdown ---
      const browsers = await ctx.db.blogPostView.groupBy({
        by: ["browser"],
        _count: { id: true },
        where: { browser: { not: null } },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      });

      // --- Country breakdown ---
      const countries = await ctx.db.blogPostView.groupBy({
        by: ["country"],
        _count: { id: true },
        where: { country: { not: null } },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      });

      // --- Referrer breakdown ---
      const referrers = await ctx.db.blogPostView.groupBy({
        by: ["referrer"],
        _count: { id: true },
        where: { referrer: { not: null } },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      });

      // --- Engagement rate ---
      const totalViews = aggregates._sum.viewsCount || 0;
      const totalLikes = aggregates._sum.likesCount || 0;
      const totalComments = aggregates._sum.commentsCount || 0;
      // Blog não tem shares/saves: passa 0 para usar a fórmula canônica
      const engagementRate = calculateEngagementRate(
        totalViews,
        totalLikes,
        totalComments,
        0,
        0
      ).toFixed(2);

      // --- Recent activity (last 10 likes/comments) ---
      const recentLikes = await ctx.db.blogPostLike.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, imageUrl: true } },
          post: { select: { title: true, slug: true } },
        },
      });

      const recentComments = await ctx.db.blogComment.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { name: true, imageUrl: true } },
          post: { select: { title: true, slug: true } },
        },
      });

      return {
        // Totals
        totalPosts: aggregates._count,
        publishedCount,
        totalViews,
        totalLikes,
        totalComments,
        totalShares: aggregates._sum.sharesCount || 0,
        avgViews: Math.round(aggregates._avg.viewsCount || 0),
        avgLikes: Math.round(aggregates._avg.likesCount || 0),
        avgComments: Math.round(aggregates._avg.commentsCount || 0),
        avgReadTime: Math.round(aggregates._avg.readTimeMinutes || 0),
        engagementRate,
        // Period data
        viewsToday, viewsLast7, viewsLast30,
        likesToday, likesLast7, likesLast30,
        commentsToday, commentsLast7, commentsLast30,
        // Charts
        viewsByDay, likesByDay, commentsByDay,
        // Rankings
        topPostsByViews, topPostsByLikes, topPostsByComments,
        // Category
        categoryPerformance,
        // Demographics
        devices: devices.map((d) => ({ device: d.device || "unknown", count: d._count.id })),
        browsers: browsers.map((b) => ({ browser: b.browser || "unknown", count: b._count.id })),
        countries: countries.map((c) => ({ country: c.country || "unknown", count: c._count.id })),
        referrers: referrers.map((r) => ({ referrer: r.referrer || "direct", count: r._count.id })),
        // Recent activity
        recentLikes: recentLikes.map((l) => ({
          userName: l.user.name || "Anônimo",
          userImage: l.user.imageUrl,
          postTitle: l.post.title,
          postSlug: l.post.slug,
          createdAt: l.createdAt,
        })),
        recentComments: recentComments.map((c) => ({
          userName: c.author.name || "Anônimo",
          userImage: c.author.imageUrl,
          postTitle: c.post.title,
          postSlug: c.post.slug,
          content: c.content.slice(0, 100),
          createdAt: c.createdAt,
        })),
      };
    } catch (error: any) {
      console.error("Erro ao buscar relatórios:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar relatórios",
      });
    }
  }),

  // Alternar destaque do post
  togglePostFeatured: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const post = await ctx.db.blogPost.findUnique({ where: { id: input.id } });
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado" });

        return await ctx.db.blogPost.update({
          where: { id: input.id },
          data: { isFeatured: !post.isFeatured },
        });
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

  // Alternar fixado
  togglePostPinned: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const post = await ctx.db.blogPost.findUnique({ where: { id: input.id } });
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado" });

        return await ctx.db.blogPost.update({
          where: { id: input.id },
          data: { isPinned: !post.isPinned },
        });
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

  // Alterar status do post
  updatePostStatus: adminProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data: any = { status: input.status };

        if (input.status === "PUBLISHED") {
          data.publishedAt = new Date();
        }

        return await ctx.db.blogPost.update({
          where: { id: input.id },
          data,
        });
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

  // Atualizar conteúdo do post (texto, imagem, etc)
  updatePostContent: adminProcedure
    .input(z.object({
      id: z.string(),
      content: z.string().optional(),
      title: z.string().optional(),
      excerpt: z.string().optional(),
      coverImageUrl: z.string().optional(),
      readTimeMinutes: z.number().optional(),
      tags: z.array(z.string()).optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;
        const updateData: any = {};
        if (data.content !== undefined) updateData.content = data.content;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
        if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
        if (data.readTimeMinutes !== undefined) updateData.readTimeMinutes = data.readTimeMinutes;
        if (data.tags !== undefined) updateData.tags = data.tags;
        if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
        if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;

        return await ctx.db.blogPost.update({
          where: { id },
          data: updateData,
        });
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

  // Excluir post
  deletePost: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.blogPost.delete({ where: { id: input.id } });
        return { success: true };
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

  // Reordenar categorias
  reorderCategories: adminProcedure
    .input(
      z.object({
        orderedIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updates = input.orderedIds.map((id, index) =>
          ctx.db.blogCategory.update({
            where: { id },
            data: { order: index + 1 },
          })
        );

        await Promise.all(updates);

        return { success: true };
      } catch (error: any) {
        console.error("Erro ao reordenar categorias:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao reordenar categorias",
        });
      }
    }),

  // ============================================================================
  // AI BLOG GENERATION
  // ============================================================================

  // Gerar sugestões de tópicos para blog
  generateTopicSuggestions: adminProcedure
    .input(
      z.object({
        count: z.number().min(1).max(10).default(5),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

        // Buscar categorias e posts existentes para contexto
        const [categories, existingPosts] = await Promise.all([
          ctx.db.blogCategory.findMany({
            where: { isActive: true },
            select: { id: true, title: true, slug: true, description: true },
          }),
          ctx.db.blogPost.findMany({
            select: { title: true },
            orderBy: { createdAt: "desc" },
            take: 30,
          }),
        ]);

        const existingTitles = existingPosts.map((p) => p.title).join("\n- ");
        const categoriesList = categories.map((c) => `${c.title} (${c.slug}): ${c.description || "sem descrição"}`).join("\n- ");

        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `Você é um estrategista de conteúdo especializado em marketing digital, criação de conteúdo para redes sociais e empreendedorismo digital. Estamos em 2026.

═══════════════════════════════════════════════════════════
SOBRE A CLIPFY — LEIA TUDO COM ATENÇÃO
═══════════════════════════════════════════════════════════

A **Clipfy** é uma plataforma brasileira de marketing de influência fundada em 2024 e ativa em 2026. Ela conecta **CLIPADORES** (criadores de conteúdo especializados em cortes de vídeo) com **EMPRESAS** (marcas e negócios que querem divulgação nas redes sociais).

🔹 O QUE É UM CLIPADOR?
Um clipador é um criador de conteúdo que faz CORTES de vídeos — ou seja, pega trechos relevantes de lives, vídeos longos, podcasts, gameplays ou cria vídeos curtos originais — e publica nas redes sociais em formato vertical (TikTok, YouTube Shorts, Instagram Reels, Kwai). O objetivo é gerar views, engajamento e viralização. Qualquer pessoa pode ser um clipador, desde iniciantes até criadores experientes.

🔹 COMO FUNCIONA A CLIPFY?
1. Uma EMPRESA cria uma "campanha" (também chamada de "liga" ou "competição") na Clipfy. A empresa define: o produto/marca a ser divulgado, as regras, o prêmio total e a duração da competição.
2. CLIPADORES se inscrevem nessa campanha/liga gratuitamente.
3. Os clipadores criam vídeos curtos (clips) divulgando o produto/marca da empresa e postam nas redes sociais (TikTok, YouTube Shorts, Instagram Reels, etc).
4. A Clipfy rastreia as métricas de cada clip (views, curtidas, compartilhamentos, engajamento).
5. Ao final do período da campanha, os clipadores com MELHOR DESEMPENHO (mais views, mais engajamento) vencem a competição e recebem as premiações em dinheiro.

🔹 POR QUE É INOVADOR?
- Para EMPRESAS: É uma forma de marketing com custo-benefício incrível. Em vez de pagar um influenciador grande, a empresa lança uma competição e dezenas/centenas de clipadores criam conteúdo para ela. A marca paga apenas os premiados e ganha centenas de vídeos orgânicos divulgando seu produto.
- Para CLIPADORES: É uma oportunidade de monetizar sua habilidade de criar vídeos curtos. Mesmo quem tem poucos seguidores pode participar — o que importa é a qualidade do conteúdo e a capacidade de viralizar.
- A Clipfy funciona como um "campeonato de cortes" — são ligas/competições onde o desempenho do clip determina o vencedor.

🔹 TERMOS IMPORTANTES DA CLIPFY:
- **Clipador**: Criador de cortes/clipes de vídeo
- **Liga / Competição / Campanha**: O evento criado por uma empresa onde clipadores competem
- **Clip / Corte**: O vídeo curto criado pelo clipador para divulgar a marca
- **Engajamento**: Views + curtidas + compartilhamentos + comentários do clip
- **Ranking**: Classificação dos clipadores baseada no desempenho dos clips
- **Premiação**: Dinheiro que os clipadores vencedores recebem
- **Central do Clipador**: Nome do blog da Clipfy

🔹 O QUE A CLIPFY NÃO É:
- NÃO é um jogo eletrônico
- NÃO é sobre League of Legends (LoL) nem nenhum game
- NÃO é uma plataforma de streaming
- NÃO é uma plataforma de jogos ou e-sports
- É 100% uma plataforma de MARKETING DE INFLUÊNCIA baseada em competições de clips para redes sociais

═══════════════════════════════════════════════════════════
SOBRE O BLOG "CENTRAL DO CLIPADOR"
═══════════════════════════════════════════════════════════

O blog da Clipfy se chama "Central do Clipador" e é voltado para um público amplo. Os temas incluem:
- Marketing digital e redes sociais
- Dicas e tutoriais de edição de vídeo (CapCut, Premiere, DaVinci, etc)
- Como viralizar nas redes sociais (TikTok, Instagram, YouTube Shorts)
- Monetização e renda extra como criador de conteúdo
- Empreendedorismo digital e negócios online
- Investimentos e finanças pessoais
- Tendências de tecnologia e IA em 2026
- Novidades e atualizações da plataforma Clipfy
- Estratégias de crescimento para criadores de conteúdo
- Cases de sucesso de clipadores

═══════════════════════════════════════════════════════════
REGRAS PARA SUGESTÕES
═══════════════════════════════════════════════════════════

Gere sugestões de tópicos INOVADORES e RELEVANTES para 2026, diferentes dos já existentes.
Os tópicos podem ser sobre QUALQUER tema das categorias disponíveis, não apenas sobre clipping.
NUNCA sugira temas sobre League of Legends, LoL, e-sports ou jogos a menos que exista uma categoria explícita para isso.
Considere o contexto atual de 2026 — tendências atuais, tecnologias recentes, mercado atual.`,
            },
            {
              role: "user",
              content: `Posts já existentes no blog:
- ${existingTitles || "Nenhum post ainda"}

Categorias disponíveis:
- ${categoriesList || "Nenhuma categoria"}

Gere ${input?.count || 5} sugestões de tópicos NOVOS e DIFERENTES dos existentes. Para cada sugestão, retorne:
- title: título atrativo e otimizado para SEO
- description: breve descrição do que o artigo abordaria (1-2 frases)
- categorySlug: slug da categoria mais adequada dentre as existentes (se nenhuma se encaixar, use null)

Responda APENAS com JSON válido no formato:
[{"title": "...", "description": "...", "categorySlug": "..." | null}]`,
            },
          ],
          max_completion_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content || "[]";
        // Parse JSON from response (may have markdown code block)
        const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        const suggestions = JSON.parse(jsonStr) as Array<{
          title: string;
          description: string;
          categorySlug: string | null;
        }>;

        // Map category slugs to IDs
        const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

        return suggestions.map((s) => ({
          title: s.title,
          description: s.description,
          categoryId: s.categorySlug ? categoryMap.get(s.categorySlug) || null : null,
          categorySlug: s.categorySlug,
        }));
      } catch (error: any) {
        console.error("Erro ao gerar sugestões de tópicos:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao gerar sugestões com IA",
        });
      }
    }),

  // Gerar post completo com IA (texto markdown)
  generateBlogPost: adminProcedure
    .input(
      z.object({
        prompt: z.string().min(5, "Descreva o tema do post"),
        categoryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

        // Buscar categoria selecionada se houver
        let categoryInfo = "";
        let category = null;
        if (input.categoryId) {
          category = await ctx.db.blogCategory.findUnique({
            where: { id: input.categoryId },
            select: { id: true, title: true, slug: true, description: true, color: true },
          });
          if (category) {
            categoryInfo = `\nCategoria do post: "${category.title}" — ${category.description || "sem descrição extra"}`;
          }
        }

        // Se nenhuma categoria selecionada, tentar inferir da ideia
        if (!category) {
          const categories = await ctx.db.blogCategory.findMany({
            where: { isActive: true },
            select: { id: true, title: true, slug: true, description: true, color: true },
          });

          if (categories.length > 0) {
            // Quick inference
            const inferResponse = await openai.chat.completions.create({
              model: "gpt-5-nano",
              messages: [
                {
                  role: "system",
                  content: "Escolha a categoria mais adequada para o tópico dado. Responda APENAS com o slug da categoria.",
                },
                {
                  role: "user",
                  content: `Tópico: "${input.prompt}"\n\nCategorias disponíveis:\n${categories.map((c) => `- ${c.slug}: ${c.title} (${c.description || ""})`).join("\n")}\n\nResponda APENAS com o slug, nada mais.`,
                },
              ],
              max_completion_tokens: 50,
            });

            const inferredSlug = inferResponse.choices[0]?.message?.content?.trim().replace(/"/g, "");
            category = categories.find((c) => c.slug === inferredSlug) || null;
            if (category) {
              categoryInfo = `\nCategoria inferida: "${category.title}"`;
            }
          }
        }

        // Gerar o texto completo do blog
        const response = await openai.chat.completions.create({
          model: "gpt-5.4",
          messages: [
            {
              role: "system",
              content: `Você é um escritor profissional de blog especializado em marketing digital, criação de conteúdo, redes sociais e empreendedorismo. Estamos em 2026.

═══════════════════════════════════════════════════════════
SOBRE A CLIPFY — LEIA TUDO COM ATENÇÃO
═══════════════════════════════════════════════════════════

A **Clipfy** é uma plataforma brasileira de marketing de influência fundada em 2024 e ativa em 2026. Ela conecta **CLIPADORES** (criadores de conteúdo especializados em cortes de vídeo) com **EMPRESAS** (marcas e negócios que querem divulgação nas redes sociais).

🔹 O QUE É UM CLIPADOR?
Um clipador é um criador de conteúdo que faz CORTES de vídeos — ou seja, pega trechos relevantes de lives, vídeos longos, podcasts, gameplays ou cria vídeos curtos originais — e publica nas redes sociais em formato vertical (TikTok, YouTube Shorts, Instagram Reels, Kwai). O objetivo é gerar views, engajamento e viralização. Qualquer pessoa pode ser um clipador, desde iniciantes até criadores experientes.

🔹 COMO FUNCIONA A CLIPFY?
1. Uma EMPRESA cria uma "campanha" (também chamada de "liga" ou "competição") na Clipfy. A empresa define: o produto/marca a ser divulgado, as regras, o prêmio total e a duração da competição.
2. CLIPADORES se inscrevem nessa campanha/liga gratuitamente.
3. Os clipadores criam vídeos curtos (clips) divulgando o produto/marca da empresa e postam nas redes sociais (TikTok, YouTube Shorts, Instagram Reels, etc).
4. A Clipfy rastreia as métricas de cada clip (views, curtidas, compartilhamentos, engajamento).
5. Ao final do período da campanha, os clipadores com MELHOR DESEMPENHO (mais views, mais engajamento) vencem a competição e recebem as premiações em dinheiro.

🔹 POR QUE É INOVADOR?
- Para EMPRESAS: É uma forma de marketing com custo-benefício incrível. Em vez de pagar um influenciador grande, a empresa lança uma competição e dezenas/centenas de clipadores criam conteúdo para ela. A marca paga apenas os premiados e ganha centenas de vídeos orgânicos divulgando seu produto.
- Para CLIPADORES: É uma oportunidade de monetizar sua habilidade de criar vídeos curtos. Mesmo quem tem poucos seguidores pode participar — o que importa é a qualidade do conteúdo e a capacidade de viralizar.
- A Clipfy funciona como um "campeonato de cortes" — são ligas/competições onde o desempenho do clip determina o vencedor.

🔹 TERMOS IMPORTANTES DA CLIPFY:
- **Clipador**: Criador de cortes/clipes de vídeo
- **Liga / Competição / Campanha**: O evento criado por uma empresa onde clipadores competem
- **Clip / Corte**: O vídeo curto criado pelo clipador para divulgar a marca
- **Engajamento**: Views + curtidas + compartilhamentos + comentários do clip
- **Ranking**: Classificação dos clipadores baseada no desempenho dos clips
- **Premiação**: Dinheiro que os clipadores vencedores recebem
- **Central do Clipador**: Nome do blog da Clipfy

🔹 O QUE A CLIPFY NÃO É:
- NÃO é um jogo eletrônico
- NÃO é sobre League of Legends (LoL) nem nenhum game
- NÃO é uma plataforma de streaming
- NÃO é uma plataforma de jogos ou e-sports
- É 100% uma plataforma de MARKETING DE INFLUÊNCIA baseada em competições de clips para redes sociais

═══════════════════════════════════════════════════════════
SOBRE O BLOG "CENTRAL DO CLIPADOR"
═══════════════════════════════════════════════════════════

O blog da Clipfy se chama "Central do Clipador" e é voltado para um público amplo. Os temas incluem:
- Marketing digital e redes sociais
- Dicas e tutoriais de edição de vídeo (CapCut, Premiere, DaVinci, etc)
- Como viralizar nas redes sociais (TikTok, Instagram, YouTube Shorts)
- Monetização e renda extra como criador de conteúdo
- Empreendedorismo digital e negócios online
- Investimentos e finanças pessoais
- Tendências de tecnologia e IA em 2026
- Novidades e atualizações da plataforma Clipfy
- Estratégias de crescimento para criadores de conteúdo

═══════════════════════════════════════════════════════════
REGRAS DE ESCRITA
═══════════════════════════════════════════════════════════

1. Escreva em PORTUGUÊS BRASILEIRO
2. Use Markdown completo (headings ##, ###, **bold**, *italic*, listas, blockquotes, etc)
3. O texto deve ser LONGO (mínimo 1500 palavras), NARRATIVO, envolvente e educativo
4. Use uma linguagem acessível mas profissional, adequada para 2026
5. Inclua exemplos práticos, dicas acionáveis e insights valiosos e atuais
6. Estruture com H2 e H3, use listas quando fizer sentido
7. Inclua uma introdução cativante e uma conclusão com call-to-action
8. Escreva sobre o TEMA SOLICITADO de forma profunda e completa — o tema pode ou não estar relacionado à Clipfy diretamente
9. NÃO inclua o título H1 no início (será adicionado separadamente)
10. NÃO inclua metadados ou front matter
11. Faça o texto parecer escrito por um especialista real da área em 2026
12. Se o tema for diretamente relacionado à Clipfy, mencione a plataforma naturalmente com os termos corretos; caso contrário, foque 100% no tema solicitado sem forçar menções à Clipfy
13. Use emojis de forma SUTIL e MODERADA — apenas alguns emojis estratégicos nos títulos de seção (H2/H3) e em pontos-chave para dar vida ao texto, mas SEM exagerar. Máximo de 1 emoji por heading e alguns poucos ao longo do texto
14. NUNCA mencione League of Legends, LoL, e-sports ou jogos a menos que o tema EXPLICITAMENTE peça isso
15. Considere o contexto atual de 2026 — tendências atuais, tecnologias recentes, mercado atual${categoryInfo}`,
            },
            {
              role: "user",
              content: `Escreva um artigo de blog COMPLETO sobre o seguinte tema:\n\n"${input.prompt}"\n\nIMPORTANTE: Foque 100% no tema acima. Se o tema é sobre investimentos, escreva sobre investimentos. Se é sobre marketing, escreva sobre marketing. NÃO desvie para assuntos de jogos ou League of Legends a não ser que o tema explicitamente peça isso. Considere que estamos em 2026.\n\nLembre-se: texto longo (mínimo 1500 palavras), narrativo, com markdown rico, prático e envolvente.`,
            },
          ],
        });

        const generatedContent = response.choices[0]?.message?.content || "";

        // Gerar título e metadados
        const metaResponse = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: "Gere metadados para um artigo do blog 'Central do Clipador' (da Clipfy, plataforma brasileira de marketing de influência fundada em 2024). A Clipfy conecta clipadores (criadores de cortes de vídeo) com empresas através de competições/ligas de engajamento nas redes sociais. O blog abrange temas diversos: marketing digital, investimentos, criação de conteúdo, empreendedorismo, tecnologia, etc. NÃO é sobre jogos ou League of Legends. Estamos em 2026. Responda APENAS com JSON válido.",
            },
            {
              role: "user",
              content: `Com base neste tema: "${input.prompt}"

E neste conteúdo (primeiros 500 chars): "${generatedContent.substring(0, 500)}"

Gere um JSON com:
{
  "title": "título atrativo e otimizado para SEO (máximo 80 chars)",
  "excerpt": "resumo envolvente do artigo (máximo 200 chars)",
  "slug": "slug-url-amigavel-em-minusculas",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "metaTitle": "título para SEO (máximo 60 chars)",
  "metaDescription": "meta description para Google (máximo 160 chars)"
}`,
            },
          ],
          max_completion_tokens: 500,
        });

        const metaContent = metaResponse.choices[0]?.message?.content || "{}";
        const metaJsonStr = metaContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

        let meta: {
          title?: string;
          excerpt?: string;
          slug?: string;
          tags?: string[];
          metaTitle?: string;
          metaDescription?: string;
        };
        try {
          meta = JSON.parse(metaJsonStr);
        } catch {
          meta = {};
        }

        const fallbackTitle = meta.title || input.prompt.slice(0, 80);
        const fallbackSlug = (meta.slug || fallbackTitle)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80);

        const wordCount = generatedContent.split(/\s+/).length;
        const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        return {
          title: fallbackTitle,
          slug: fallbackSlug,
          excerpt: meta.excerpt || generatedContent.substring(0, 200).replace(/[#*_\n]/g, "").trim(),
          content: generatedContent,
          tags: meta.tags || [],
          metaTitle: meta.metaTitle || fallbackTitle,
          metaDescription: meta.metaDescription || meta.excerpt || "",
          readTimeMinutes,
          categoryId: category?.id || null,
          categoryTitle: category?.title || null,
          categoryColor: category?.color || null,
        };
      } catch (error: any) {
        console.error("Erro ao gerar post com IA:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao gerar post com IA",
        });
      }
    }),

  // Gerar imagem de capa com GPT Image
  generateBlogImage: adminProcedure
    .input(
      z.object({
        title: z.string(),
        excerpt: z.string().optional(),
        categoryTitle: z.string().optional(),
        userPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

        const imagePrompt = `Create a stunning, modern, cinematic blog cover image that visually represents the topic: "${input.title}".
${input.excerpt ? `The article is about: ${input.excerpt}` : ""}
${input.categoryTitle ? `Category: ${input.categoryTitle}` : ""}
${input.userPrompt ? `\nADDITIONAL USER INSTRUCTIONS FOR THE IMAGE (follow these if they contain visual/image directions): "${input.userPrompt}"` : ""}

CRITICAL: The image MUST visually relate to the article's topic. If the user provided specific image instructions above, prioritize those. Examples:
- If the topic is about investments/finance → show coins, charts, growth graphs, money concepts
- If the topic is about social media → show phones, social platforms, engagement visuals
- If the topic is about video editing → show editing timeline, camera, creative workspace
- If the topic is about marketing → show creative campaigns, branding elements, audience
- If the topic is about trends → show modern lifestyle, trending visuals
- If the topic is about community → show people connecting, networking, collaboration

Style requirements:
- Modern, clean, professional editorial/magazine style
- Rich, vibrant colors that match the mood of the topic
- Cinematic lighting with depth and atmosphere
- Photorealistic or high-quality 3D render aesthetic
- 16:9 aspect ratio composition
- Visually compelling and eye-catching for a blog cover
- NO text, NO letters, NO words, NO watermarks, NO logos on the image
- The image should feel like a premium stock photo or editorial illustration`;

        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: imagePrompt,
          n: 1,
          size: "1536x1024",
          quality: "high",
        });

        const imageData = response.data?.[0];
        if (!imageData) {
          throw new Error("Nenhuma imagem gerada");
        }

        let imageBuffer: Buffer;
        if (imageData.b64_json) {
          imageBuffer = Buffer.from(imageData.b64_json, "base64");
        } else if (imageData.url) {
          const imgResponse = await fetch(imageData.url);
          if (!imgResponse.ok) throw new Error("Falha ao baixar imagem gerada");
          imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
        } else {
          throw new Error("Imagem gerada sem dados");
        }

        const slug = input.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 50);
        const fileName = `blog-cover-${slug}-${Date.now()}.png`;

        const utapi = new UTApi();
        const file = new UTFile([new Uint8Array(imageBuffer)], fileName, { type: "image/png" });
        const uploadResult = await utapi.uploadFiles(file);

        if (uploadResult.error) {
          throw new Error(`Erro ao enviar imagem para UploadThing: ${uploadResult.error.message}`);
        }

        return { imageUrl: uploadResult.data.url };
      } catch (error: any) {
        console.error("Erro ao gerar imagem com IA:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao gerar imagem com IA",
        });
      }
    }),

  // Editar texto do blog com IA
  editBlogText: adminProcedure
    .input(
      z.object({
        currentContent: z.string(),
        editInstruction: z.string().min(3, "Descreva o que deseja alterar"),
        title: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `Você é um editor profissional de blog especializado em marketing digital, criação de conteúdo e empreendedorismo. Estamos em 2026. Sua tarefa é editar/reescrever o texto de um artigo do blog "Central do Clipador" (blog da Clipfy).

CONTEXTO DA CLIPFY:
A Clipfy é uma plataforma brasileira de marketing de influência (fundada em 2024, ativa em 2026) que conecta CLIPADORES (criadores de cortes de vídeo) com EMPRESAS através de competições/ligas de engajamento nas redes sociais. Empresas criam campanhas, clipadores se inscrevem e competem criando vídeos curtos (clips) para divulgar marcas no TikTok, YouTube Shorts, Instagram Reels, etc. Os melhores clipadores (mais views e engajamento) vencem e recebem premiações em dinheiro. É um "campeonato de cortes".

IMPORTANTE: A Clipfy NÃO é sobre jogos, League of Legends ou e-sports. É 100% marketing de influência com competições de clips.

REGRAS:
1. Mantenha o formato Markdown (##, ###, **bold**, *italic*, listas, etc)
2. Mantenha o texto em PORTUGUÊS BRASILEIRO
3. Aplique APENAS as mudanças solicitadas pelo usuário
4. Mantenha a qualidade e o tom profissional
5. NÃO adicione título H1
6. Retorne APENAS o conteúdo editado em markdown, nada mais
7. Se o texto original não tem referência a jogos, NÃO adicione referências a jogos
8. Use terminologia correta da Clipfy se mencioná-la (clipador, liga, campanha, clip, etc)
9. Considere que estamos em 2026`,
            },
            {
              role: "user",
              content: `Título do artigo: "${input.title}"

Conteúdo atual do artigo:
${input.currentContent}

---

Instrução de edição: "${input.editInstruction}"

Aplique a edição e retorne o texto completo editado em markdown.`,
            },
          ],
          max_completion_tokens: 8000,
        });

        const editedContent = response.choices[0]?.message?.content || input.currentContent;

        // Recalcular tempo de leitura
        const wordCount = editedContent.split(/\s+/).length;
        const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        return {
          content: editedContent,
          readTimeMinutes,
        };
      } catch (error: any) {
        console.error("Erro ao editar texto com IA:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao editar texto com IA",
        });
      }
    }),

  // Salvar post gerado pela IA no banco
  saveAIGeneratedPost: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        excerpt: z.string().optional(),
        content: z.string().min(1),
        coverImageUrl: z.string().optional(),
        tags: z.array(z.string()).default([]),
        categoryId: z.string().optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        readTimeMinutes: z.number().optional(),
        status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Garantir slug único
        let slug = input.slug;
        let counter = 1;
        while (await ctx.db.blogPost.findUnique({ where: { slug } })) {
          slug = `${input.slug}-${counter}`;
          counter++;
        }

        const post = await ctx.db.blogPost.create({
          data: {
            title: input.title,
            slug,
            excerpt: input.excerpt || null,
            content: input.content,
            coverImageUrl: input.coverImageUrl || null,
            tags: input.tags,
            categoryId: input.categoryId || null,
            metaTitle: input.metaTitle || null,
            metaDescription: input.metaDescription || null,
            readTimeMinutes: input.readTimeMinutes || null,
            status: input.status,
            publishedAt: input.status === "PUBLISHED" ? new Date() : null,
            authorId: ctx.userId,
          },
          include: {
            author: { select: { id: true, name: true, email: true, imageUrl: true } },
            category: { select: { id: true, title: true, slug: true, color: true } },
          },
        });

        return post;
      } catch (error: any) {
        console.error("Erro ao salvar post gerado por IA:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao salvar post",
        });
      }
    }),

  // ============================================================================
  // PUBLIC ROUTES (Blog público, acessível por todos)
  // ============================================================================

  // Listar posts publicados para o blog público
  getPublicPosts: publicProcedure
    .input(
      z.object({
        categorySlug: z.string().optional(),
        tag: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(12),
        cursor: z.string().optional(), // For infinite scroll / pagination
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const limit = input?.limit ?? 12;
        const where: any = {
          status: "PUBLISHED",
          publishedAt: { not: null },
        };

        if (input?.categorySlug) {
          where.category = { slug: input.categorySlug };
        }

        if (input?.tag) {
          where.tags = { has: input.tag };
        }

        if (input?.search) {
          where.OR = [
            { title: { contains: input.search, mode: "insensitive" } },
            { excerpt: { contains: input.search, mode: "insensitive" } },
          ];
        }

        const posts = await ctx.db.blogPost.findMany({
          where,
          take: limit + 1,
          ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          orderBy: [
            { isPinned: "desc" },
            { isFeatured: "desc" },
            { publishedAt: "desc" },
          ],
          include: {
            author: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
            category: {
              select: {
                id: true,
                title: true,
                slug: true,
                color: true,
              },
            },
          },
        });

        let nextCursor: string | undefined = undefined;
        if (posts.length > limit) {
          const nextItem = posts.pop();
          nextCursor = nextItem?.id;
        }

        return {
          posts: posts.map((post) => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            coverImageUrl: post.coverImageUrl,
            tags: post.tags,
            isFeatured: post.isFeatured,
            isPinned: post.isPinned,
            publishedAt: post.publishedAt,
            viewsCount: post.viewsCount,
            likesCount: post.likesCount,
            commentsCount: post.commentsCount,
            readTimeMinutes: post.readTimeMinutes,
            author: post.author,
            category: post.category,
          })),
          nextCursor,
        };
      } catch (error: any) {
        console.error("Erro ao buscar posts públicos:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao carregar posts",
        });
      }
    }),

  // Buscar post por slug (público)
  getPublicPostBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const post = await ctx.db.blogPost.findUnique({
          where: { slug: input.slug },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
            category: {
              select: {
                id: true,
                title: true,
                slug: true,
                color: true,
              },
            },
          },
        });

        if (!post || post.status !== "PUBLISHED") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Post não encontrado",
          });
        }

        // Incrementar views
        await ctx.db.blogPost.update({
          where: { id: post.id },
          data: { viewsCount: { increment: 1 } },
        });

        // Registrar view detalhada na tabela BlogPostView (para gráficos e analytics)
        try {
          const userAgent = ctx.headers.get("user-agent") || undefined;
          const referer = ctx.headers.get("referer") || undefined;
          const forwarded = ctx.headers.get("x-forwarded-for");
          const realIp = ctx.headers.get("x-real-ip");
          const rawIp = forwarded?.split(",")[0]?.trim() || realIp || undefined;

          // Hash simples do IP para privacidade
          let ipHash: string | undefined;
          if (rawIp) {
            const encoder = new TextEncoder();
            const data = encoder.encode(rawIp + "clipfy-salt-2025");
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            ipHash = Array.from(new Uint8Array(hashBuffer))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
              .slice(0, 16);
          }

          // Detectar dispositivo
          let device: string | undefined;
          if (userAgent) {
            const ua = userAgent.toLowerCase();
            if (/tablet|ipad/i.test(ua)) device = "tablet";
            else if (/mobile|android|iphone|ipod/i.test(ua)) device = "mobile";
            else device = "desktop";
          }

          // Detectar navegador
          let browser: string | undefined;
          if (userAgent) {
            if (/edg/i.test(userAgent)) browser = "Edge";
            else if (/opr|opera/i.test(userAgent)) browser = "Opera";
            else if (/chrome|crios/i.test(userAgent)) browser = "Chrome";
            else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
            else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
            else browser = "Other";
          }

          // Detectar OS
          let os: string | undefined;
          if (userAgent) {
            const ua = userAgent.toLowerCase();
            if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
            else if (/android/i.test(ua)) os = "Android";
            else if (/windows/i.test(ua)) os = "Windows";
            else if (/mac os|macos/i.test(ua)) os = "macOS";
            else if (/linux/i.test(ua)) os = "Linux";
          }

          // Extrair referrer simplificado
          let referrer: string | undefined;
          if (referer) {
            try {
              const url = new URL(referer);
              const host = url.hostname.replace("www.", "");
              if (host.includes("google")) referrer = "Google";
              else if (host.includes("instagram")) referrer = "Instagram";
              else if (host.includes("tiktok")) referrer = "TikTok";
              else if (host.includes("twitter") || host.includes("x.com")) referrer = "Twitter/X";
              else if (host.includes("facebook")) referrer = "Facebook";
              else if (host.includes("youtube")) referrer = "YouTube";
              else if (host.includes("linkedin")) referrer = "LinkedIn";
              else if (host.includes("reddit")) referrer = "Reddit";
              else referrer = host;
            } catch {
              referrer = "direct";
            }
          } else {
            referrer = "direct";
          }

          // Extrair UTM params do referer
          let utmSource: string | undefined;
          let utmMedium: string | undefined;
          if (referer) {
            try {
              const url = new URL(referer);
              utmSource = url.searchParams.get("utm_source") || undefined;
              utmMedium = url.searchParams.get("utm_medium") || undefined;
            } catch {
              // ignore
            }
          }

          await ctx.db.blogPostView.create({
            data: {
              postId: post.id,
              userAgent,
              ipHash,
              device,
              browser,
              os,
              referrer,
              utmSource,
              utmMedium,
            },
          });
        } catch (viewError) {
          // Não falhar a request se o registro de view detalhada falhar
          console.error("Erro ao registrar view detalhada:", viewError);
        }

        return {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverImageUrl: post.coverImageUrl,
          tags: post.tags,
          isFeatured: post.isFeatured,
          isPinned: post.isPinned,
          publishedAt: post.publishedAt,
          viewsCount: post.viewsCount + 1,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          sharesCount: post.sharesCount,
          readTimeMinutes: post.readTimeMinutes,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          author: post.author,
          category: post.category,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("Erro ao buscar post:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao carregar post",
        });
      }
    }),

  getRelatedPosts: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        categoryId: z.string().optional(),
        tags: z.array(z.string()).default([]),
        limit: z.number().min(1).max(8).default(4),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const orConditions: any[] = [];
        if (input.categoryId) {
          orConditions.push({ categoryId: input.categoryId });
        }
        if (input.tags.length > 0) {
          orConditions.push({ tags: { hasSome: input.tags } });
        }

        let posts = await ctx.db.blogPost.findMany({
          where: {
            id: { not: input.postId },
            status: "PUBLISHED",
            publishedAt: { not: null },
            ...(orConditions.length > 0 ? { OR: orConditions } : {}),
          },
          orderBy: [{ viewsCount: "desc" }, { publishedAt: "desc" }],
          take: input.limit,
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImageUrl: true,
            publishedAt: true,
            readTimeMinutes: true,
            viewsCount: true,
            likesCount: true,
            tags: true,
            category: { select: { title: true, slug: true, color: true } },
            author: { select: { name: true, imageUrl: true } },
          },
        });

        if (posts.length < input.limit) {
          const existingIds = [input.postId, ...posts.map((p) => p.id)];
          const fallback = await ctx.db.blogPost.findMany({
            where: {
              id: { notIn: existingIds },
              status: "PUBLISHED",
              publishedAt: { not: null },
            },
            orderBy: [{ viewsCount: "desc" }, { publishedAt: "desc" }],
            take: input.limit - posts.length,
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              coverImageUrl: true,
              publishedAt: true,
              readTimeMinutes: true,
              viewsCount: true,
              likesCount: true,
              tags: true,
              category: { select: { title: true, slug: true, color: true } },
              author: { select: { name: true, imageUrl: true } },
            },
          });
          posts = [...posts, ...fallback];
        }

        return posts;
      } catch (error: any) {
        console.error("Erro ao buscar posts relacionados:", error);
        return [];
      }
    }),

  // Listar categorias ativas (público)
  getPublicCategories: publicProcedure.query(async ({ ctx }) => {
    try {
      const categories = await ctx.db.blogCategory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: {
          _count: {
            select: {
              posts: {
                where: { status: "PUBLISHED" },
              },
            },
          },
        },
      });

      return categories.map((cat) => ({
        id: cat.id,
        title: cat.title,
        slug: cat.slug,
        description: cat.description,
        coverImageUrl: cat.coverImageUrl,
        color: cat.color,
        postsCount: cat._count.posts,
      }));
    } catch (error: any) {
      console.error("Erro ao buscar categorias públicas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao carregar categorias",
      });
    }
  }),

  // Stats públicas (para exibir no header do blog)
  getPublicStats: publicProcedure.query(async ({ ctx }) => {
    try {
      const [totalPosts, totalCategories] = await Promise.all([
        ctx.db.blogPost.count({ where: { status: "PUBLISHED" } }),
        ctx.db.blogCategory.count({ where: { isActive: true } }),
      ]);

      const aggregates = await ctx.db.blogPost.aggregate({
        where: { status: "PUBLISHED" },
        _sum: {
          viewsCount: true,
        },
      });

      return {
        totalPosts,
        totalCategories,
        totalViews: aggregates._sum.viewsCount || 0,
      };
    } catch (error: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao carregar estatísticas",
      });
    }
  }),

  // ============================================================================
  // LIKES & COMMENTS (PUBLIC/PRIVATE)
  // ============================================================================

  // Verificar se o usuário curtiu um post (retorna null se não logado)
  checkPostLike: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const { currentUser } = await import("@clerk/nextjs/server");
        const user = await currentUser();
        if (!user) return { liked: false, userId: null };

        const like = await ctx.db.blogPostLike.findUnique({
          where: {
            postId_userId: {
              postId: input.postId,
              userId: user.id,
            },
          },
        });

        return { liked: !!like, userId: user.id };
      } catch {
        return { liked: false, userId: null };
      }
    }),

  // Toggle like em um post (requer login)
  togglePostLike: privateProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existingLike = await ctx.db.blogPostLike.findUnique({
          where: {
            postId_userId: {
              postId: input.postId,
              userId: ctx.userId,
            },
          },
        });

        if (existingLike) {
          // Remove like
          await ctx.db.blogPostLike.delete({
            where: { id: existingLike.id },
          });
          await ctx.db.blogPost.update({
            where: { id: input.postId },
            data: { likesCount: { decrement: 1 } },
          });
          return { liked: false };
        } else {
          // Add like
          await ctx.db.blogPostLike.create({
            data: {
              postId: input.postId,
              userId: ctx.userId,
            },
          });
          await ctx.db.blogPost.update({
            where: { id: input.postId },
            data: { likesCount: { increment: 1 } },
          });
          return { liked: true };
        }
      } catch (error: any) {
        console.error("Erro ao toggle like:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao curtir post",
        });
      }
    }),

  // Buscar comentários de um post (público)
  getPostComments: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        sortBy: z.enum(["recent", "popular"]).default("recent"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { currentUser } = await import("@clerk/nextjs/server");
        const user = await currentUser();

        const comments = await ctx.db.blogComment.findMany({
          where: {
            postId: input.postId,
            status: "APPROVED",
            parentId: null, // Only top-level comments
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
            likes: user
              ? {
                  where: { userId: user.id },
                  select: { id: true },
                }
              : false,
            replies: {
              where: { status: "APPROVED" },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                },
                likes: user
                  ? {
                      where: { userId: user.id },
                      select: { id: true },
                    }
                  : false,
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy:
            input.sortBy === "popular"
              ? { likesCount: "desc" }
              : { createdAt: "desc" },
        });

        return comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          isPinned: comment.isPinned,
          likesCount: comment.likesCount,
          likedByMe: Array.isArray(comment.likes) && comment.likes.length > 0,
          editedAt: comment.editedAt,
          createdAt: comment.createdAt,
          author: comment.author,
          replies: comment.replies.map((reply) => ({
            id: reply.id,
            content: reply.content,
            isPinned: reply.isPinned,
            likesCount: reply.likesCount,
            likedByMe: Array.isArray(reply.likes) && reply.likes.length > 0,
            editedAt: reply.editedAt,
            createdAt: reply.createdAt,
            author: reply.author,
          })),
        }));
      } catch (error: any) {
        console.error("Erro ao buscar comentários:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao carregar comentários",
        });
      }
    }),

  // Adicionar comentário (requer login)
  addComment: privateProcedure
    .input(
      z.object({
        postId: z.string(),
        content: z.string().min(1, "Comentário não pode ser vazio").max(2000, "Máximo 2000 caracteres"),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verificar se o post existe e está publicado
        const post = await ctx.db.blogPost.findUnique({
          where: { id: input.postId },
          select: { id: true, status: true },
        });

        if (!post || post.status !== "PUBLISHED") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Post não encontrado",
          });
        }

        // Se parentId, verificar se comentário pai existe
        if (input.parentId) {
          const parent = await ctx.db.blogComment.findUnique({
            where: { id: input.parentId },
            select: { id: true, postId: true },
          });
          if (!parent || parent.postId !== input.postId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Comentário pai não encontrado",
            });
          }
        }

        const comment = await ctx.db.blogComment.create({
          data: {
            postId: input.postId,
            authorId: ctx.userId,
            content: input.content,
            parentId: input.parentId || null,
            status: "APPROVED", // Auto-approve for logged-in users
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        });

        // Incrementar contagem de comentários do post
        await ctx.db.blogPost.update({
          where: { id: input.postId },
          data: { commentsCount: { increment: 1 } },
        });

        return {
          id: comment.id,
          content: comment.content,
          isPinned: false,
          likesCount: 0,
          likedByMe: false,
          editedAt: null,
          createdAt: comment.createdAt,
          author: comment.author,
          replies: [],
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("Erro ao criar comentário:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao adicionar comentário",
        });
      }
    }),

  // Toggle like em um comentário (requer login)
  toggleCommentLike: privateProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existingLike = await ctx.db.blogCommentLike.findUnique({
          where: {
            commentId_userId: {
              commentId: input.commentId,
              userId: ctx.userId,
            },
          },
        });

        if (existingLike) {
          await ctx.db.blogCommentLike.delete({
            where: { id: existingLike.id },
          });
          await ctx.db.blogComment.update({
            where: { id: input.commentId },
            data: { likesCount: { decrement: 1 } },
          });
          return { liked: false };
        } else {
          await ctx.db.blogCommentLike.create({
            data: {
              commentId: input.commentId,
              userId: ctx.userId,
            },
          });
          await ctx.db.blogComment.update({
            where: { id: input.commentId },
            data: { likesCount: { increment: 1 } },
          });
          return { liked: true };
        }
      } catch (error: any) {
        console.error("Erro ao toggle like do comentário:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao curtir comentário",
        });
      }
    }),

  // Deletar comentário (requer login + ser o autor)
  deleteComment: privateProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const comment = await ctx.db.blogComment.findUnique({
          where: { id: input.commentId },
          select: { id: true, authorId: true, postId: true },
        });

        if (!comment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Comentário não encontrado" });
        }

        if (comment.authorId !== ctx.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para deletar" });
        }

        // Count replies to decrement properly
        const repliesCount = await ctx.db.blogComment.count({
          where: { parentId: comment.id },
        });

        await ctx.db.blogComment.delete({
          where: { id: input.commentId },
        });

        // Decrement comment count (1 for the comment + replies)
        await ctx.db.blogPost.update({
          where: { id: comment.postId },
          data: { commentsCount: { decrement: 1 + repliesCount } },
        });

        return { deleted: true };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("Erro ao deletar comentário:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao deletar comentário",
        });
      }
    }),

  // ============================================================================
  // ADMIN COMMENTS MANAGEMENT
  // ============================================================================

  // Listar todos os comentários (admin)
  getAdminComments: adminProcedure
    .input(
      z.object({
        status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED", "SPAM"]).default("ALL"),
        search: z.string().optional(),
        postId: z.string().optional(),
        sortBy: z.enum(["recent", "oldest", "likes"]).default("recent"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (input.status !== "ALL") {
          where.status = input.status;
        }

        if (input.postId) {
          where.postId = input.postId;
        }

        if (input.search) {
          where.OR = [
            { content: { contains: input.search, mode: "insensitive" } },
            { author: { name: { contains: input.search, mode: "insensitive" } } },
            { author: { email: { contains: input.search, mode: "insensitive" } } },
          ];
        }

        const orderBy: any =
          input.sortBy === "oldest"
            ? { createdAt: "asc" }
            : input.sortBy === "likes"
              ? { likesCount: "desc" }
              : { createdAt: "desc" };

        const [comments, total] = await Promise.all([
          ctx.db.blogComment.findMany({
            where,
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  imageUrl: true,
                },
              },
              post: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  coverImageUrl: true,
                },
              },
              parent: {
                select: {
                  id: true,
                  content: true,
                  author: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  replies: true,
                  likes: true,
                },
              },
            },
            orderBy,
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.blogComment.count({ where }),
        ]);

        return {
          comments,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error: any) {
        console.error("Erro ao buscar comentários admin:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar comentários",
        });
      }
    }),

  // Estatísticas de comentários (admin)
  getCommentsStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [total, pending, approved, rejected, spam, today, thisWeek, topPosts, topCommenters] = await Promise.all([
        ctx.db.blogComment.count(),
        ctx.db.blogComment.count({ where: { status: "PENDING" } }),
        ctx.db.blogComment.count({ where: { status: "APPROVED" } }),
        ctx.db.blogComment.count({ where: { status: "REJECTED" } }),
        ctx.db.blogComment.count({ where: { status: "SPAM" } }),
        ctx.db.blogComment.count({
          where: {
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        ctx.db.blogComment.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        // Top posts by comments
        ctx.db.blogPost.findMany({
          where: { commentsCount: { gt: 0 } },
          select: {
            id: true,
            title: true,
            slug: true,
            commentsCount: true,
            coverImageUrl: true,
            category: {
              select: {
                title: true,
                color: true,
              },
            },
          },
          orderBy: { commentsCount: "desc" },
          take: 5,
        }),
        // Top commenters
        ctx.db.blogComment.groupBy({
          by: ["authorId"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 5,
        }),
      ]);

      // Fetch user details for top commenters
      const commenterIds = topCommenters.map((c) => c.authorId);
      const users = await ctx.db.user.findMany({
        where: { id: { in: commenterIds } },
        select: { id: true, name: true, email: true, imageUrl: true },
      });

      const topCommentersWithDetails = topCommenters.map((c) => {
        const user = users.find((u) => u.id === c.authorId);
        return {
          userId: c.authorId,
          count: c._count.id,
          name: user?.name || user?.email?.split("@")[0] || "Desconhecido",
          imageUrl: user?.imageUrl || null,
        };
      });

      // Replies count
      const repliesCount = await ctx.db.blogComment.count({
        where: { parentId: { not: null } },
      });

      return {
        total,
        pending,
        approved,
        rejected,
        spam,
        today,
        thisWeek,
        repliesCount,
        topPosts,
        topCommenters: topCommentersWithDetails,
      };
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas de comentários:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar estatísticas",
      });
    }
  }),

  // Atualizar status de comentário (admin)
  adminUpdateCommentStatus: adminProcedure
    .input(
      z.object({
        commentId: z.string(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "SPAM"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const comment = await ctx.db.blogComment.findUnique({
          where: { id: input.commentId },
          select: { id: true, postId: true, status: true },
        });

        if (!comment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Comentário não encontrado" });
        }

        const wasApproved = comment.status === "APPROVED";
        const willBeApproved = input.status === "APPROVED";

        await ctx.db.blogComment.update({
          where: { id: input.commentId },
          data: { status: input.status },
        });

        // Update post comment count
        if (wasApproved && !willBeApproved) {
          await ctx.db.blogPost.update({
            where: { id: comment.postId },
            data: { commentsCount: { decrement: 1 } },
          });
        } else if (!wasApproved && willBeApproved) {
          await ctx.db.blogPost.update({
            where: { id: comment.postId },
            data: { commentsCount: { increment: 1 } },
          });
        }

        return { success: true };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar status do comentário",
        });
      }
    }),

  // Editar conteúdo de comentário (admin)
  adminEditComment: adminProcedure
    .input(
      z.object({
        commentId: z.string(),
        content: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const comment = await ctx.db.blogComment.update({
          where: { id: input.commentId },
          data: {
            content: input.content,
            editedAt: new Date(),
          },
        });

        return comment;
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao editar comentário",
        });
      }
    }),

  // Deletar comentário (admin - sem restrição de autor)
  adminDeleteComment: adminProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const comment = await ctx.db.blogComment.findUnique({
          where: { id: input.commentId },
          select: { id: true, postId: true, status: true },
        });

        if (!comment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Comentário não encontrado" });
        }

        const repliesCount = await ctx.db.blogComment.count({
          where: { parentId: comment.id },
        });

        await ctx.db.blogComment.delete({
          where: { id: input.commentId },
        });

        // Only decrement if was approved
        if (comment.status === "APPROVED") {
          await ctx.db.blogPost.update({
            where: { id: comment.postId },
            data: { commentsCount: { decrement: 1 + repliesCount } },
          });
        }

        return { deleted: true };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao deletar comentário",
        });
      }
    }),

  // Fixar/desfixar comentário (admin)
  adminToggleCommentPinned: adminProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const comment = await ctx.db.blogComment.findUnique({
          where: { id: input.commentId },
          select: { id: true, isPinned: true },
        });

        if (!comment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Comentário não encontrado" });
        }

        const updated = await ctx.db.blogComment.update({
          where: { id: input.commentId },
          data: { isPinned: !comment.isPinned },
        });

        return { isPinned: updated.isPinned };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao fixar comentário",
        });
      }
    }),

  // Ação em lote nos comentários (admin)
  adminBulkCommentAction: adminProcedure
    .input(
      z.object({
        commentIds: z.array(z.string()),
        action: z.enum(["APPROVE", "REJECT", "SPAM", "DELETE"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.action === "DELETE") {
          // Get comments info before deleting for count updates
          const comments = await ctx.db.blogComment.findMany({
            where: { id: { in: input.commentIds } },
            select: { id: true, postId: true, status: true },
          });

          // Get replies counts
          const repliesCounts = await ctx.db.blogComment.groupBy({
            by: ["parentId"],
            where: { parentId: { in: input.commentIds } },
            _count: { id: true },
          });

          await ctx.db.blogComment.deleteMany({
            where: { id: { in: input.commentIds } },
          });

          // Update post comment counts for approved comments
          const postDecrements: Record<string, number> = {};
          for (const comment of comments) {
            if (comment.status === "APPROVED") {
              const repliesForThis = repliesCounts.find((r) => r.parentId === comment.id)?._count.id || 0;
              postDecrements[comment.postId] = (postDecrements[comment.postId] || 0) + 1 + repliesForThis;
            }
          }

          for (const [postId, decrement] of Object.entries(postDecrements)) {
            await ctx.db.blogPost.update({
              where: { id: postId },
              data: { commentsCount: { decrement } },
            });
          }
        } else {
          const statusMap = {
            APPROVE: "APPROVED" as const,
            REJECT: "REJECTED" as const,
            SPAM: "SPAM" as const,
          };

          const newStatus = statusMap[input.action];

          // Get current statuses to handle count changes
          const comments = await ctx.db.blogComment.findMany({
            where: { id: { in: input.commentIds } },
            select: { id: true, postId: true, status: true },
          });

          await ctx.db.blogComment.updateMany({
            where: { id: { in: input.commentIds } },
            data: { status: newStatus },
          });

          // Update post comment counts
          const postChanges: Record<string, number> = {};
          for (const comment of comments) {
            const wasApproved = comment.status === "APPROVED";
            const willBeApproved = newStatus === "APPROVED";
            if (wasApproved && !willBeApproved) {
              postChanges[comment.postId] = (postChanges[comment.postId] || 0) - 1;
            } else if (!wasApproved && willBeApproved) {
              postChanges[comment.postId] = (postChanges[comment.postId] || 0) + 1;
            }
          }

          for (const [postId, change] of Object.entries(postChanges)) {
            if (change > 0) {
              await ctx.db.blogPost.update({
                where: { id: postId },
                data: { commentsCount: { increment: change } },
              });
            } else if (change < 0) {
              await ctx.db.blogPost.update({
                where: { id: postId },
                data: { commentsCount: { decrement: Math.abs(change) } },
              });
            }
          }
        }

        return { success: true, count: input.commentIds.length };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro na ação em lote",
        });
      }
    }),
});

