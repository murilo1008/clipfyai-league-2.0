import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { canUseAIClips } from "@/server/league-clips/access";
import { privateProcedure, createTRPCRouter } from "@/server/api/trpc";
import { leagueClips } from "@/server/league-clips/client";
import {
  aspects,
  createBrandKitSchema,
  patchBrandKitSchema,
  createProjectSchema,
  createUploadSchema,
  patchClipSchema,
  statuses,
} from "@/server/league-clips/contracts";

const clipsProcedure = privateProcedure.use(({ ctx, next }) => {
  if (!canUseAIClips(ctx.user))
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "AI Clips indisponível.",
    });
  return next();
});
const ref = z.object({ id: z.string().min(1) });
export const leagueClipsRouter = createTRPCRouter({
  access: privateProcedure.query(({ ctx }) => ({
    enabled: canUseAIClips(ctx.user),
  })),
  brandKits: clipsProcedure.query(({ ctx }) =>
    leagueClips.brandKits(ctx.userId),
  ),
  brandKit: clipsProcedure
    .input(ref)
    .query(({ ctx, input }) => leagueClips.brandKit(ctx.userId, input.id)),
  createBrandKit: clipsProcedure
    .input(createBrandKitSchema)
    .mutation(({ ctx, input }) =>
      leagueClips.createBrandKit(ctx.userId, input),
    ),
  patchBrandKit: clipsProcedure
    .input(
      z.object({
        id: z.string(),
        version: z.number().int().positive(),
        patch: patchBrandKitSchema,
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.patchBrandKit(
        ctx.userId,
        input.id,
        input.version,
        input.patch,
      ),
    ),
  deleteBrandKit: clipsProcedure
    .input(ref)
    .mutation(({ ctx, input }) =>
      leagueClips.deleteBrandKit(ctx.userId, input.id),
    ),
  setDefaultBrandKit: clipsProcedure
    .input(ref)
    .mutation(({ ctx, input }) =>
      leagueClips.setDefaultBrandKit(ctx.userId, input.id),
    ),
  logoUpload: clipsProcedure
    .input(
      z.object({
        id: z.string(),
        contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        sizeBytes: z
          .number()
          .int()
          .positive()
          .max(2 * 1024 * 1024),
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.logoUpload(
        ctx.userId,
        input.id,
        input.contentType,
        input.sizeBytes,
      ),
    ),
  attachLogo: clipsProcedure
    .input(
      z.object({
        id: z.string(),
        version: z.number().int().positive(),
        uploadKey: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.attachLogo(
        ctx.userId,
        input.id,
        input.version,
        input.uploadKey,
      ),
    ),
  removeLogo: clipsProcedure
    .input(z.object({ id: z.string(), version: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      leagueClips.removeLogo(ctx.userId, input.id, input.version),
    ),
  list: clipsProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(12),
        status: z.enum(statuses).optional(),
      }),
    )
    .query(({ ctx, input }) => leagueClips.list(ctx.userId, input)),
  project: clipsProcedure
    .input(ref)
    .query(({ ctx, input }) => leagueClips.project(ctx.userId, input.id)),
  create: clipsProcedure
    .input(createProjectSchema)
    .mutation(({ ctx, input }) => leagueClips.create(ctx.userId, input)),
  cancel: clipsProcedure
    .input(ref)
    .mutation(({ ctx, input }) => leagueClips.cancel(ctx.userId, input.id)),
  delete: clipsProcedure
    .input(ref)
    .mutation(({ ctx, input }) => leagueClips.delete(ctx.userId, input.id)),
  clips: clipsProcedure
    .input(ref)
    .query(({ ctx, input }) => leagueClips.clips(ctx.userId, input.id)),
  clip: clipsProcedure
    .input(ref)
    .query(({ ctx, input }) => leagueClips.clip(ctx.userId, input.id)),
  transcript: clipsProcedure
    .input(ref)
    .query(({ ctx, input }) => leagueClips.transcript(ctx.userId, input.id)),
  patch: clipsProcedure
    .input(
      z.object({
        id: z.string(),
        version: z.number().int().positive(),
        changes: patchClipSchema,
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.patch(ctx.userId, input.id, input.version, input.changes),
    ),
  render: clipsProcedure
    .input(
      z.object({
        id: z.string(),
        aspectRatios: z.array(z.enum(aspects)).min(1).max(2).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.render(ctx.userId, input.id, input.aspectRatios),
    ),
  exportClip: clipsProcedure
    .input(
      z.object({
        id: z.string().min(1),
        aspectRatios: z.array(z.enum(aspects)).min(1).max(2).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.exportClip(ctx.userId, input.id, input.aspectRatios),
    ),
  templates: clipsProcedure.query(({ ctx }) =>
    leagueClips.templates(ctx.userId),
  ),
  credits: clipsProcedure.query(({ ctx }) => leagueClips.credits(ctx.userId)),
  ledger: clipsProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .query(({ ctx, input }) => leagueClips.ledger(ctx.userId, input.cursor)),
  createUpload: clipsProcedure
    .input(createUploadSchema)
    .mutation(({ ctx, input }) => leagueClips.createUpload(ctx.userId, input)),
  upload: clipsProcedure
    .input(ref)
    .query(({ ctx, input }) => leagueClips.upload(ctx.userId, input.id)),
  uploadParts: clipsProcedure
    .input(
      z.object({
        id: z.string(),
        partNumbers: z
          .array(z.number().int().min(1).max(10000))
          .min(1)
          .max(1000),
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.uploadParts(ctx.userId, input.id, input.partNumbers),
    ),
  completeUpload: clipsProcedure
    .input(
      z.object({
        id: z.string(),
        parts: z
          .array(
            z.object({
              partNumber: z.number().int().positive(),
              etag: z.string().min(1).max(256),
            }),
          )
          .min(1)
          .max(10000),
      }),
    )
    .mutation(({ ctx, input }) =>
      leagueClips.completeUpload(ctx.userId, input.id, input.parts),
    ),
  abortUpload: clipsProcedure
    .input(ref)
    .mutation(({ ctx, input }) =>
      leagueClips.abortUpload(ctx.userId, input.id),
    ),
});
