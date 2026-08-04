import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "@/env";
import { adminProcedure, createTRPCRouter, privateProcedure } from "../trpc";

const FALLBACK_APP_URL = "https://league.clipfyai.com";

// O default de env.NEXT_PUBLIC_APP_URL não é aplicado quando SKIP_ENV_VALIDATION
// está ligado (build em CI/Docker), então resolvemos de forma preguiçosa e com
// fallback — senão o import deste router derruba o build inteiro.
function getAppUrl() {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  return (raw || FALLBACK_APP_URL).replace(/\/$/, "");
}

function buildAffiliateUrl(code: string) {
  return `${getAppUrl()}/sign-up?ref=${encodeURIComponent(code)}`;
}

function formatReferral(user: {
  id: string;
  name: string | null;
  email: string;
  imageUrl: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  clipperProfile: { verificationStatus: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl,
    onboardingCompleted: user.onboardingCompleted,
    verificationStatus: user.clipperProfile?.verificationStatus ?? "UNVERIFIED",
    createdAt: user.createdAt,
  };
}

export const affiliateRouter = createTRPCRouter({
  getMine: privateProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.clipperProfile.findUnique({
      where: { userId: ctx.userId },
      select: {
        affiliateCode: true,
        referredUsers: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            onboardingCompleted: true,
            createdAt: true,
            clipperProfile: {
              select: { verificationStatus: true },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Complete seu perfil de clipador para criar um link de afiliado.",
      });
    }

    const completed = profile.referredUsers.filter(
      (user) => user.onboardingCompleted,
    ).length;
    const verified = profile.referredUsers.filter(
      (user) => user.clipperProfile?.verificationStatus === "VERIFIED",
    ).length;

    return {
      affiliateCode: profile.affiliateCode,
      affiliateUrl: profile.affiliateCode
        ? buildAffiliateUrl(profile.affiliateCode)
        : null,
      stats: {
        registrations: profile.referredUsers.length,
        completed,
        verified,
      },
      referrals: profile.referredUsers.slice(0, 50).map(formatReferral),
    };
  }),

  createLink: privateProcedure.mutation(async ({ ctx }) => {
    const profile = await ctx.db.clipperProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true, affiliateCode: true },
    });

    if (!profile) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Complete seu perfil de clipador para criar um link de afiliado.",
      });
    }

    if (profile.affiliateCode) {
      return {
        affiliateCode: profile.affiliateCode,
        affiliateUrl: buildAffiliateUrl(profile.affiliateCode),
      };
    }

    // Tenta algumas vezes porque affiliateCode é @unique e pode colidir.
    for (let attempt = 0; attempt < 5; attempt++) {
      const affiliateCode = randomBytes(5).toString("hex");
      const existing = await ctx.db.clipperProfile.findUnique({
        where: { affiliateCode },
        select: { id: true },
      });

      if (!existing) {
        await ctx.db.clipperProfile.update({
          where: { id: profile.id },
          data: { affiliateCode },
        });

        return {
          affiliateCode,
          affiliateUrl: buildAffiliateUrl(affiliateCode),
        };
      }
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Não foi possível gerar o link. Tente novamente.",
    });
  }),

  adminList: adminProcedure
    .input(
      z
        .object({
          search: z.string().trim().max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search;
      const affiliates = await ctx.db.clipperProfile.findMany({
        where: {
          affiliateCode: { not: null },
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" } },
                  { artisticName: { contains: search, mode: "insensitive" } },
                  { affiliateCode: { contains: search, mode: "insensitive" } },
                  {
                    user: {
                      email: { contains: search, mode: "insensitive" },
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          fullName: true,
          artisticName: true,
          affiliateCode: true,
          user: {
            select: {
              email: true,
              imageUrl: true,
            },
          },
          referredUsers: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              email: true,
              imageUrl: true,
              onboardingCompleted: true,
              createdAt: true,
              clipperProfile: {
                select: { verificationStatus: true },
              },
            },
          },
        },
      });

      const rows = affiliates.flatMap((affiliate) => {
        // O where já garante affiliateCode não-nulo; o guard existe só para o TypeScript.
        const affiliateCode = affiliate.affiliateCode;
        if (!affiliateCode) return [];

        const referrals = affiliate.referredUsers.map(formatReferral);
        return [
          {
            id: affiliate.id,
            name: affiliate.artisticName || affiliate.fullName,
            fullName: affiliate.fullName,
            email: affiliate.user.email,
            imageUrl: affiliate.user.imageUrl,
            affiliateCode,
            affiliateUrl: buildAffiliateUrl(affiliateCode),
            stats: {
              registrations: referrals.length,
              completed: referrals.filter((item) => item.onboardingCompleted)
                .length,
              verified: referrals.filter(
                (item) => item.verificationStatus === "VERIFIED",
              ).length,
            },
            referrals,
          },
        ];
      });

      return {
        affiliates: rows,
        stats: {
          activeAffiliates: rows.length,
          registrations: rows.reduce(
            (total, row) => total + row.stats.registrations,
            0,
          ),
          completed: rows.reduce(
            (total, row) => total + row.stats.completed,
            0,
          ),
          verified: rows.reduce((total, row) => total + row.stats.verified, 0),
        },
      };
    }),
});
