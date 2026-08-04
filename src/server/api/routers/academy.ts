import { createTRPCRouter, privateProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const academyRouter = createTRPCRouter({
  // ============================================================================
  // ÁREA DE MEMBROS (CLIPPER VIEW)
  // ============================================================================

  // Buscar módulos e aulas publicados para área de membros
  getMemberContent: privateProcedure.query(async ({ ctx }) => {
    try {
      // Buscar módulos publicados com aulas publicadas
      const modules = await ctx.db.academyModule.findMany({
        where: { isPublished: true },
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { order: "asc" },
            include: {
              _count: {
                select: {
                  progress: { where: { completed: true } },
                  likes: true,
                },
              },
            },
          },
        },
      });

      // Buscar progresso do usuário
      const userProgress = await ctx.db.academyLessonProgress.findMany({
        where: { userId: ctx.userId },
        select: {
          lessonId: true,
          completed: true,
          progressPercent: true,
        },
      });

      // Buscar curtidas do usuário
      const userLikes = await ctx.db.academyLessonLike.findMany({
        where: { userId: ctx.userId },
        select: { lessonId: true },
      });

      const progressMap = new Map(
        userProgress.map((p) => [p.lessonId, p])
      );
      const likesSet = new Set(userLikes.map((l) => l.lessonId));

      // Calcular estatísticas gerais
      const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
      const completedLessons = userProgress.filter((p) => p.completed).length;
      const totalDuration = modules.reduce(
        (sum, m) => sum + m.lessons.reduce((s, l) => s + (l.duration || 0), 0),
        0
      );

      return {
        modules: modules.map((module) => {
          const moduleLessons = module.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            description: lesson.description,
            videoUrl: lesson.videoUrl,
            thumbnailUrl: lesson.thumbnailUrl,
            duration: lesson.duration,
            order: lesson.order,
            isFree: lesson.isFree,
            completedCount: lesson._count.progress,
            likesCount: lesson._count.likes,
            isCompleted: progressMap.get(lesson.id)?.completed || false,
            progressPercent: progressMap.get(lesson.id)?.progressPercent || 0,
            isLiked: likesSet.has(lesson.id),
          }));

          const moduleCompletedLessons = moduleLessons.filter((l) => l.isCompleted).length;
          const moduleProgress = moduleLessons.length > 0
            ? Math.round((moduleCompletedLessons / moduleLessons.length) * 100)
            : 0;

          return {
            id: module.id,
            title: module.title,
            slug: module.slug,
            description: module.description,
            coverImageUrl: module.coverImageUrl,
            order: module.order,
            lessons: moduleLessons,
            lessonsCount: moduleLessons.length,
            completedLessonsCount: moduleCompletedLessons,
            progress: moduleProgress,
            totalDuration: moduleLessons.reduce((sum, l) => sum + (l.duration || 0), 0),
          };
        }),
        stats: {
          totalModules: modules.length,
          totalLessons,
          completedLessons,
          totalDuration,
          overallProgress: totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0,
        },
      };
    } catch (error: any) {
      console.error("Erro ao buscar conteúdo da academia:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar conteúdo da academia",
      });
    }
  }),

  // Marcar aula como assistida/completada
  markLessonComplete: privateProcedure
    .input(
      z.object({
        lessonId: z.string(),
        completed: z.boolean().default(true),
        progressPercent: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const progress = await ctx.db.academyLessonProgress.upsert({
          where: {
            lessonId_userId: {
              lessonId: input.lessonId,
              userId: ctx.userId,
            },
          },
          create: {
            lessonId: input.lessonId,
            userId: ctx.userId,
            completed: input.completed,
            progressPercent: input.progressPercent || (input.completed ? 100 : 0),
            watchedAt: input.completed ? new Date() : null,
          },
          update: {
            completed: input.completed,
            progressPercent: input.progressPercent || (input.completed ? 100 : 0),
            watchedAt: input.completed ? new Date() : null,
          },
        });

        return progress;
      } catch (error: any) {
        console.error("Erro ao marcar aula:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao marcar aula",
        });
      }
    }),

  // Curtir/descurtir aula
  toggleLessonLike: privateProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existingLike = await ctx.db.academyLessonLike.findUnique({
          where: {
            lessonId_userId: {
              lessonId: input.lessonId,
              userId: ctx.userId,
            },
          },
        });

        if (existingLike) {
          await ctx.db.academyLessonLike.delete({
            where: { id: existingLike.id },
          });
          return { liked: false };
        } else {
          await ctx.db.academyLessonLike.create({
            data: {
              lessonId: input.lessonId,
              userId: ctx.userId,
            },
          });
          return { liked: true };
        }
      } catch (error: any) {
        console.error("Erro ao curtir aula:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao curtir aula",
        });
      }
    }),

  // Buscar detalhes de uma aula específica
  getLessonDetails: privateProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.db.academyLesson.findUnique({
          where: { slug: input.slug },
          include: {
            module: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
            _count: {
              select: {
                progress: { where: { completed: true } },
                likes: true,
              },
            },
          },
        });

        if (!lesson || !lesson.isPublished) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Aula não encontrada",
          });
        }

        // Buscar progresso e like do usuário
        const [userProgress, userLike] = await Promise.all([
          ctx.db.academyLessonProgress.findUnique({
            where: {
              lessonId_userId: {
                lessonId: lesson.id,
                userId: ctx.userId,
              },
            },
          }),
          ctx.db.academyLessonLike.findUnique({
            where: {
              lessonId_userId: {
                lessonId: lesson.id,
                userId: ctx.userId,
              },
            },
          }),
        ]);

        // Buscar próxima e anterior aula
        const [nextLesson, prevLesson] = await Promise.all([
          ctx.db.academyLesson.findFirst({
            where: {
              moduleId: lesson.moduleId,
              order: { gt: lesson.order },
              isPublished: true,
            },
            orderBy: { order: "asc" },
            select: { slug: true, title: true },
          }),
          ctx.db.academyLesson.findFirst({
            where: {
              moduleId: lesson.moduleId,
              order: { lt: lesson.order },
              isPublished: true,
            },
            orderBy: { order: "desc" },
            select: { slug: true, title: true },
          }),
        ]);

        return {
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          description: lesson.description,
          videoUrl: lesson.videoUrl,
          thumbnailUrl: lesson.thumbnailUrl,
          duration: lesson.duration,
          order: lesson.order,
          isFree: lesson.isFree,
          module: lesson.module,
          completedCount: lesson._count.progress,
          likesCount: lesson._count.likes,
          isCompleted: userProgress?.completed || false,
          progressPercent: userProgress?.progressPercent || 0,
          isLiked: !!userLike,
          nextLesson,
          prevLesson,
        };
      } catch (error: any) {
        console.error("Erro ao buscar aula:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar aula",
        });
      }
    }),

  // ============================================================================
  // ADMIN - VISÃO GERAL
  // ============================================================================

  // Buscar visão geral da academia (para admin)
  getOverview: privateProcedure.query(async ({ ctx }) => {
    try {
      // Buscar total de módulos
      const totalModules = await ctx.db.academyModule.count();
      const publishedModules = await ctx.db.academyModule.count({
        where: { isPublished: true },
      });

      // Buscar total de aulas
      const totalLessons = await ctx.db.academyLesson.count();
      const publishedLessons = await ctx.db.academyLesson.count({
        where: { isPublished: true },
      });

      // Calcular duração total das aulas (em segundos)
      const durationResult = await ctx.db.academyLesson.aggregate({
        _sum: { duration: true },
      });
      const totalDurationSeconds = durationResult._sum.duration || 0;

      // Buscar total de visualizações (aulas completadas)
      const totalCompletedLessons = await ctx.db.academyLessonProgress.count({
        where: { completed: true },
      });

      // Buscar total de curtidas
      const totalLikes = await ctx.db.academyLessonLike.count();

      // Buscar módulos com contagem de aulas
      const modules = await ctx.db.academyModule.findMany({
        orderBy: { order: "asc" },
        include: {
          lessons: {
            select: {
              id: true,
              title: true,
              duration: true,
              isPublished: true,
            },
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              lessons: true,
            },
          },
        },
      });

      // Buscar aulas recentes
      const recentLessons = await ctx.db.academyLesson.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          module: {
            select: {
              title: true,
              slug: true,
            },
          },
          _count: {
            select: {
              progress: {
                where: { completed: true },
              },
              likes: true,
            },
          },
        },
      });

      return {
        stats: {
          totalModules,
          publishedModules,
          draftModules: totalModules - publishedModules,
          totalLessons,
          publishedLessons,
          draftLessons: totalLessons - publishedLessons,
          totalDurationSeconds,
          totalCompletedLessons,
          totalLikes,
        },
        modules: modules.map((module) => ({
          id: module.id,
          title: module.title,
          slug: module.slug,
          description: module.description,
          coverImageUrl: module.coverImageUrl,
          order: module.order,
          isPublished: module.isPublished,
          lessonsCount: module._count.lessons,
          publishedLessonsCount: module.lessons.filter((l) => l.isPublished).length,
          totalDuration: module.lessons.reduce((sum, l) => sum + (l.duration || 0), 0),
          createdAt: module.createdAt.toISOString(),
          updatedAt: module.updatedAt.toISOString(),
        })),
        recentLessons: recentLessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          thumbnailUrl: lesson.thumbnailUrl,
          duration: lesson.duration,
          isPublished: lesson.isPublished,
          isFree: lesson.isFree,
          moduleTitle: lesson.module.title,
          moduleSlug: lesson.module.slug,
          completedCount: lesson._count.progress,
          likesCount: lesson._count.likes,
          createdAt: lesson.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      console.error("Erro ao buscar visão geral da academia:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar dados da academia",
      });
    }
  }),

  // Buscar todos os módulos (para admin)
  getAllModules: privateProcedure.query(async ({ ctx }) => {
    try {
      const modules = await ctx.db.academyModule.findMany({
        orderBy: { order: "asc" },
        include: {
          _count: {
            select: {
              lessons: true,
            },
          },
        },
      });

      return modules.map((module) => ({
        id: module.id,
        title: module.title,
        slug: module.slug,
        description: module.description,
        coverImageUrl: module.coverImageUrl,
        order: module.order,
        isPublished: module.isPublished,
        lessonsCount: module._count.lessons,
        createdAt: module.createdAt.toISOString(),
        updatedAt: module.updatedAt.toISOString(),
      }));
    } catch (error: any) {
      console.error("Erro ao buscar módulos:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar módulos",
      });
    }
  }),

  // Criar novo módulo
  createModule: privateProcedure
    .input(
      z.object({
        title: z.string().min(1, "Título é obrigatório"),
        description: z.string().optional(),
        coverImageUrl: z.string().optional(),
        isPublished: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Gerar slug a partir do título
        const baseSlug = input.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        // Verificar se slug já existe e adicionar sufixo se necessário
        let slug = baseSlug;
        let counter = 1;
        while (await ctx.db.academyModule.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Buscar maior ordem atual
        const maxOrder = await ctx.db.academyModule.aggregate({
          _max: { order: true },
        });
        const nextOrder = (maxOrder._max.order || 0) + 1;

        const module = await ctx.db.academyModule.create({
          data: {
            title: input.title,
            slug,
            description: input.description || null,
            coverImageUrl: input.coverImageUrl || null,
            order: nextOrder,
            isPublished: input.isPublished,
          },
        });

        return {
          id: module.id,
          title: module.title,
          slug: module.slug,
          description: module.description,
          coverImageUrl: module.coverImageUrl,
          order: module.order,
          isPublished: module.isPublished,
        };
      } catch (error: any) {
        console.error("Erro ao criar módulo:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao criar módulo",
        });
      }
    }),

  // Atualizar módulo
  updateModule: privateProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1, "Título é obrigatório").optional(),
        description: z.string().optional().nullable(),
        coverImageUrl: z.string().optional().nullable(),
        isPublished: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        // Se título mudou, atualizar slug
        let updateData: any = { ...data };
        if (data.title) {
          const baseSlug = data.title
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

          // Verificar se slug já existe (excluindo o próprio módulo)
          let slug = baseSlug;
          let counter = 1;
          while (
            await ctx.db.academyModule.findFirst({
              where: { slug, id: { not: id } },
            })
          ) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
          updateData.slug = slug;
        }

        const module = await ctx.db.academyModule.update({
          where: { id },
          data: updateData,
        });

        return module;
      } catch (error: any) {
        console.error("Erro ao atualizar módulo:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar módulo",
        });
      }
    }),

  // Deletar módulo
  deleteModule: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.academyModule.delete({
          where: { id: input.id },
        });
        return { success: true };
      } catch (error: any) {
        console.error("Erro ao deletar módulo:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao deletar módulo",
        });
      }
    }),

  // Alternar publicação do módulo
  toggleModulePublish: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const module = await ctx.db.academyModule.findUnique({
          where: { id: input.id },
        });

        if (!module) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Módulo não encontrado",
          });
        }

        const updated = await ctx.db.academyModule.update({
          where: { id: input.id },
          data: { isPublished: !module.isPublished },
        });

        return updated;
      } catch (error: any) {
        console.error("Erro ao alternar publicação:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao alternar publicação",
        });
      }
    }),

  // Reordenar módulos
  reorderModules: privateProcedure
    .input(
      z.object({
        modules: z.array(
          z.object({
            id: z.string(),
            order: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Atualizar ordem de todos os módulos
        await Promise.all(
          input.modules.map((m) =>
            ctx.db.academyModule.update({
              where: { id: m.id },
              data: { order: m.order },
            })
          )
        );

        return { success: true };
      } catch (error: any) {
        console.error("Erro ao reordenar módulos:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao reordenar módulos",
        });
      }
    }),

  // Mover módulo para cima ou para baixo
  moveModule: privateProcedure
    .input(
      z.object({
        id: z.string(),
        direction: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const currentModule = await ctx.db.academyModule.findUnique({
          where: { id: input.id },
        });

        if (!currentModule) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Módulo não encontrado",
          });
        }

        // Buscar módulo adjacente
        const adjacentModule = await ctx.db.academyModule.findFirst({
          where: {
            order:
              input.direction === "up"
                ? { lt: currentModule.order }
                : { gt: currentModule.order },
          },
          orderBy: {
            order: input.direction === "up" ? "desc" : "asc",
          },
        });

        if (!adjacentModule) {
          return { success: false, message: "Não é possível mover nesta direção" };
        }

        // Trocar ordens
        await ctx.db.$transaction([
          ctx.db.academyModule.update({
            where: { id: currentModule.id },
            data: { order: adjacentModule.order },
          }),
          ctx.db.academyModule.update({
            where: { id: adjacentModule.id },
            data: { order: currentModule.order },
          }),
        ]);

        return { success: true };
      } catch (error: any) {
        console.error("Erro ao mover módulo:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao mover módulo",
        });
      }
    }),

  // ============================================================================
  // AULAS
  // ============================================================================

  // Buscar todas as aulas
  getAllLessons: privateProcedure.query(async ({ ctx }) => {
    try {
      const lessons = await ctx.db.academyLesson.findMany({
        orderBy: [
          { module: { order: "asc" } },
          { order: "asc" },
        ],
        include: {
          module: {
            select: {
              id: true,
              title: true,
              slug: true,
              isPublished: true,
            },
          },
          _count: {
            select: {
              progress: { where: { completed: true } },
              likes: true,
            },
          },
        },
      });

      return lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        thumbnailUrl: lesson.thumbnailUrl,
        duration: lesson.duration,
        order: lesson.order,
        isPublished: lesson.isPublished,
        isFree: lesson.isFree,
        moduleId: lesson.moduleId,
        module: lesson.module,
        completedCount: lesson._count.progress,
        likesCount: lesson._count.likes,
        createdAt: lesson.createdAt.toISOString(),
        updatedAt: lesson.updatedAt.toISOString(),
      }));
    } catch (error: any) {
      console.error("Erro ao buscar aulas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar aulas",
      });
    }
  }),

  // Criar nova aula
  createLesson: privateProcedure
    .input(
      z.object({
        moduleId: z.string(),
        title: z.string().min(1, "Título é obrigatório"),
        description: z.string().optional(),
        videoUrl: z.string().url("URL do vídeo inválida"),
        thumbnailUrl: z.string().optional(),
        duration: z.number().optional(),
        isPublished: z.boolean().default(false),
        isFree: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verificar se módulo existe
        const module = await ctx.db.academyModule.findUnique({
          where: { id: input.moduleId },
        });

        if (!module) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Módulo não encontrado",
          });
        }

        // Gerar slug
        const baseSlug = input.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        let slug = baseSlug;
        let counter = 1;
        while (await ctx.db.academyLesson.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Buscar maior ordem no módulo
        const maxOrder = await ctx.db.academyLesson.aggregate({
          where: { moduleId: input.moduleId },
          _max: { order: true },
        });
        const nextOrder = (maxOrder._max.order || 0) + 1;

        const lesson = await ctx.db.academyLesson.create({
          data: {
            moduleId: input.moduleId,
            title: input.title,
            slug,
            description: input.description || null,
            videoUrl: input.videoUrl,
            thumbnailUrl: input.thumbnailUrl || null,
            duration: input.duration || null,
            order: nextOrder,
            isPublished: input.isPublished,
            isFree: input.isFree,
          },
          include: {
            module: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        });

        return lesson;
      } catch (error: any) {
        console.error("Erro ao criar aula:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao criar aula",
        });
      }
    }),

  // Atualizar aula
  updateLesson: privateProcedure
    .input(
      z.object({
        id: z.string(),
        moduleId: z.string().optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        videoUrl: z.string().url().optional(),
        thumbnailUrl: z.string().optional().nullable(),
        duration: z.number().optional().nullable(),
        isPublished: z.boolean().optional(),
        isFree: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        let updateData: any = { ...data };

        // Se título mudou, atualizar slug
        if (data.title) {
          const baseSlug = data.title
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

          let slug = baseSlug;
          let counter = 1;
          while (
            await ctx.db.academyLesson.findFirst({
              where: { slug, id: { not: id } },
            })
          ) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
          updateData.slug = slug;
        }

        const lesson = await ctx.db.academyLesson.update({
          where: { id },
          data: updateData,
          include: {
            module: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        });

        return lesson;
      } catch (error: any) {
        console.error("Erro ao atualizar aula:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar aula",
        });
      }
    }),

  // Deletar aula
  deleteLesson: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.academyLesson.delete({
          where: { id: input.id },
        });
        return { success: true };
      } catch (error: any) {
        console.error("Erro ao deletar aula:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao deletar aula",
        });
      }
    }),

  // Alternar publicação da aula
  toggleLessonPublish: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.db.academyLesson.findUnique({
          where: { id: input.id },
        });

        if (!lesson) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Aula não encontrada",
          });
        }

        const updated = await ctx.db.academyLesson.update({
          where: { id: input.id },
          data: { isPublished: !lesson.isPublished },
        });

        return updated;
      } catch (error: any) {
        console.error("Erro ao alternar publicação:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao alternar publicação",
        });
      }
    }),

  // Alternar aula gratuita
  toggleLessonFree: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.db.academyLesson.findUnique({
          where: { id: input.id },
        });

        if (!lesson) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Aula não encontrada",
          });
        }

        const updated = await ctx.db.academyLesson.update({
          where: { id: input.id },
          data: { isFree: !lesson.isFree },
        });

        return updated;
      } catch (error: any) {
        console.error("Erro ao alternar aula gratuita:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao alternar aula gratuita",
        });
      }
    }),

  // Mover aula
  moveLesson: privateProcedure
    .input(
      z.object({
        id: z.string(),
        direction: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const currentLesson = await ctx.db.academyLesson.findUnique({
          where: { id: input.id },
        });

        if (!currentLesson) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Aula não encontrada",
          });
        }

        // Buscar aula adjacente no mesmo módulo
        const adjacentLesson = await ctx.db.academyLesson.findFirst({
          where: {
            moduleId: currentLesson.moduleId,
            order:
              input.direction === "up"
                ? { lt: currentLesson.order }
                : { gt: currentLesson.order },
          },
          orderBy: {
            order: input.direction === "up" ? "desc" : "asc",
          },
        });

        if (!adjacentLesson) {
          return { success: false, message: "Não é possível mover nesta direção" };
        }

        // Trocar ordens
        await ctx.db.$transaction([
          ctx.db.academyLesson.update({
            where: { id: currentLesson.id },
            data: { order: adjacentLesson.order },
          }),
          ctx.db.academyLesson.update({
            where: { id: adjacentLesson.id },
            data: { order: currentLesson.order },
          }),
        ]);

        return { success: true };
      } catch (error: any) {
        console.error("Erro ao mover aula:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao mover aula",
        });
      }
    }),

  // ============================================================================
  // ADMIN - MÉTRICAS & ENGAJAMENTO (Relatórios)
  // ============================================================================

  getReports: privateProcedure.query(async ({ ctx }) => {
    try {
      // 1. Estatísticas gerais
      const [
        totalModules,
        publishedModules,
        totalLessons,
        publishedLessons,
        totalCompletions,
        totalLikes,
        totalUsers,
        activeStudents,
      ] = await Promise.all([
        ctx.db.academyModule.count(),
        ctx.db.academyModule.count({ where: { isPublished: true } }),
        ctx.db.academyLesson.count(),
        ctx.db.academyLesson.count({ where: { isPublished: true } }),
        ctx.db.academyLessonProgress.count({ where: { completed: true } }),
        ctx.db.academyLessonLike.count(),
        ctx.db.academyLessonProgress.groupBy({
          by: ["userId"],
        }),
        ctx.db.academyLessonProgress.groupBy({
          by: ["userId"],
          where: { completed: true },
        }),
      ]);

      // Duração total
      const durationAgg = await ctx.db.academyLesson.aggregate({
        _sum: { duration: true },
      });
      const totalDurationSeconds = durationAgg._sum.duration || 0;

      // 2. Engajamento por módulo
      const modules = await ctx.db.academyModule.findMany({
        orderBy: { order: "asc" },
        include: {
          lessons: {
            include: {
              _count: {
                select: {
                  progress: { where: { completed: true } },
                  likes: true,
                },
              },
            },
          },
        },
      });

      const moduleStats = modules.map((mod) => {
        const totalModLessons = mod.lessons.length;
        const publishedModLessons = mod.lessons.filter((l) => l.isPublished).length;
        const totalModCompletions = mod.lessons.reduce(
          (sum, l) => sum + l._count.progress,
          0
        );
        const totalModLikes = mod.lessons.reduce(
          (sum, l) => sum + l._count.likes,
          0
        );
        const totalModDuration = mod.lessons.reduce(
          (sum, l) => sum + (l.duration || 0),
          0
        );

        return {
          id: mod.id,
          title: mod.title,
          slug: mod.slug,
          isPublished: mod.isPublished,
          order: mod.order,
          coverImageUrl: mod.coverImageUrl,
          totalLessons: totalModLessons,
          publishedLessons: publishedModLessons,
          totalCompletions: totalModCompletions,
          totalLikes: totalModLikes,
          totalDurationSeconds: totalModDuration,
          avgCompletionsPerLesson:
            totalModLessons > 0
              ? Math.round(totalModCompletions / totalModLessons)
              : 0,
        };
      });

      // 3. Top aulas mais completadas
      const topCompletedLessons = await ctx.db.academyLesson.findMany({
        orderBy: {
          progress: {
            _count: "desc",
          },
        },
        take: 10,
        include: {
          module: { select: { title: true, slug: true } },
          _count: {
            select: {
              progress: { where: { completed: true } },
              likes: true,
            },
          },
        },
      });

      // 4. Top aulas mais curtidas
      const topLikedLessons = await ctx.db.academyLesson.findMany({
        orderBy: {
          likes: {
            _count: "desc",
          },
        },
        take: 10,
        include: {
          module: { select: { title: true, slug: true } },
          _count: {
            select: {
              progress: { where: { completed: true } },
              likes: true,
            },
          },
        },
      });

      // 5. Top alunos mais ativos (mais aulas completadas)
      const topStudentsRaw = await ctx.db.academyLessonProgress.groupBy({
        by: ["userId"],
        where: { completed: true },
        _count: { lessonId: true },
        orderBy: { _count: { lessonId: "desc" } },
        take: 10,
      });

      const topStudentIds = topStudentsRaw.map((s) => s.userId);
      const topStudentUsers =
        topStudentIds.length > 0
          ? await ctx.db.user.findMany({
              where: { id: { in: topStudentIds } },
              select: { id: true, name: true, email: true, imageUrl: true },
            })
          : [];

      const userMap = new Map(topStudentUsers.map((u) => [u.id, u]));
      const topStudents = topStudentsRaw.map((s) => {
        const user = userMap.get(s.userId);
        return {
          userId: s.userId,
          name: user?.name || "Usuário desconhecido",
          email: user?.email || "",
          imageUrl: user?.imageUrl || null,
          completedLessons: s._count.lessonId,
        };
      });

      // 6. Atividade recente (últimas 20 interações)
      const recentActivity = await ctx.db.academyLessonProgress.findMany({
        where: { completed: true },
        orderBy: { watchedAt: "desc" },
        take: 20,
        include: {
          lesson: {
            select: { title: true, slug: true, module: { select: { title: true } } },
          },
          user: {
            select: { name: true, email: true, imageUrl: true },
          },
        },
      });

      // 7. Curtidas recentes
      const recentLikes = await ctx.db.academyLessonLike.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          lesson: {
            select: { title: true, slug: true, module: { select: { title: true } } },
          },
          user: {
            select: { name: true, email: true, imageUrl: true },
          },
        },
      });

      return {
        stats: {
          totalModules,
          publishedModules,
          draftModules: totalModules - publishedModules,
          totalLessons,
          publishedLessons,
          draftLessons: totalLessons - publishedLessons,
          totalCompletions,
          totalLikes,
          totalDurationSeconds,
          totalStudents: totalUsers.length,
          activeStudents: activeStudents.length,
          avgCompletionsPerStudent:
            activeStudents.length > 0
              ? Math.round(totalCompletions / activeStudents.length)
              : 0,
        },
        moduleStats,
        topCompletedLessons: topCompletedLessons.map((l) => ({
          id: l.id,
          title: l.title,
          slug: l.slug,
          duration: l.duration,
          isPublished: l.isPublished,
          isFree: l.isFree,
          moduleTitle: l.module.title,
          completedCount: l._count.progress,
          likesCount: l._count.likes,
        })),
        topLikedLessons: topLikedLessons.map((l) => ({
          id: l.id,
          title: l.title,
          slug: l.slug,
          duration: l.duration,
          isPublished: l.isPublished,
          isFree: l.isFree,
          moduleTitle: l.module.title,
          completedCount: l._count.progress,
          likesCount: l._count.likes,
        })),
        topStudents,
        recentActivity: recentActivity.map((a) => ({
          userName: a.user.name || "Anônimo",
          userEmail: a.user.email,
          userImage: a.user.imageUrl,
          lessonTitle: a.lesson.title,
          moduleTitle: a.lesson.module.title,
          completedAt: a.watchedAt?.toISOString() || a.updatedAt.toISOString(),
        })),
        recentLikes: recentLikes.map((l) => ({
          userName: l.user.name || "Anônimo",
          userEmail: l.user.email,
          userImage: l.user.imageUrl,
          lessonTitle: l.lesson.title,
          moduleTitle: l.lesson.module.title,
          likedAt: l.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      console.error("Erro ao buscar relatórios da academia:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar relatórios",
      });
    }
  }),
});

