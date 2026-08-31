import { z } from "zod";
import { createTRPCRouter, privateProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import {
  resolveTikTokPostUrl,
  TikTokUrlResolveError,
} from "@/lib/tiktok-resolve-url";
import { env } from "@/env";
import { canUseSocialIntegrations } from "@/server/api/utils/social-integrations-access";
import { calculateEngagementRate } from "@/lib/ranking-helpers";

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Carteira e extrato são dados do PRÓPRIO clipador. Um terceiro só pode ler
 * se for ADMIN — é o que a tela /clippers faz ao abrir o detalhe de alguém.
 *
 * Sem esta checagem, qualquer usuário logado lia o saldo, o total ganho e o
 * histórico de transações de qualquer clipador apenas trocando o
 * `clipperProfileId` na chamada (o id vem do input, não da sessão).
 */
async function assertCanReadClipperFinancials(
  db: PrismaClient,
  callerUserId: string,
  clipperProfileId: string,
) {
  const [target, caller] = await Promise.all([
    db.clipperProfile.findUnique({
      where: { id: clipperProfileId },
      select: { userId: true },
    }),
    db.user.findUnique({
      where: { id: callerUserId },
      select: { role: true },
    }),
  ]);

  // O dono do perfil sempre pode ler o próprio financeiro.
  if (target?.userId === callerUserId) return;
  // Admin lê de qualquer um (detalhe do clipador no painel).
  if (caller?.role === "ADMIN") return;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Você só pode consultar a sua própria carteira.",
  });
}

type LeagueErrorBody = {
  message?: string;
  error?: string;
};

/**
 * Fail-closed: com SKIP_ENV_VALIDATION o env pode chegar aqui vazio, então
 * validamos antes de montar a URL em vez de deixar o fetch quebrar.
 */
function getLeagueApiBaseUrl() {
  const rawBaseUrl = env.LEAGUE_API_URL as string | undefined;

  if (!rawBaseUrl) {
    throw new Error(
      "Integração League indisponível: LEAGUE_API_URL não está configurada",
    );
  }

  return rawBaseUrl.replace(/\/$/, "");
}

async function leagueFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = getLeagueApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (env.LEAGUE_INTERNAL_API_KEY) {
    headers.set("x-internal-api-key", env.LEAGUE_INTERNAL_API_KEY);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();

  // A API pode responder HTML em erros de gateway; não deixamos o parse estourar.
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorBody = (data ?? {}) as LeagueErrorBody;

    throw new Error(
      errorBody.message ??
        errorBody.error ??
        `Erro ao comunicar com a integração League (${response.status})`,
    );
  }

  return data as T;
}

/**
 * Extrai o platformVideoId (shortcode) da URL de acordo com a plataforma
 */
function extractPlatformVideoId(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);

    switch (platform) {
      case "INSTAGRAM": {
        // Instagram: /p/ABC123xyz/ ou /reel/ABC123xyz/
        const match = /\/(p|reel)\/([A-Za-z0-9_-]+)/.exec(urlObj.pathname);
        return match?.[2] || null;
      }

      case "TIKTOK": {
        // TikTok: /video/1234567890 (formato completo apenas)
        const match = /\/video\/(\d+)/.exec(urlObj.pathname);
        return match?.[1] || null;
      }

      case "YOUTUBE": {
        // YouTube: /shorts/ABC123xyz ou youtu.be/ABC123
        if (urlObj.hostname.includes("youtu.be")) {
          const match = /\/([A-Za-z0-9_-]+)/.exec(urlObj.pathname);
          return match?.[1] || null;
        }
        const match = /\/shorts\/([A-Za-z0-9_-]+)/.exec(urlObj.pathname);
        return match?.[1] || null;
      }

      case "KWAI": {
        // Kwai: /video/ABC123xyz, /short/ABC123, ou k.kwai.com/p/ABC123
        const matchVideo = /\/video\/([A-Za-z0-9_-]+)/.exec(urlObj.pathname);
        if (matchVideo) return matchVideo[1] || null;

        const matchShort = /\/short\/([A-Za-z0-9_-]+)/.exec(urlObj.pathname);
        if (matchShort) return matchShort[1] || null;

        // Formato curto: k.kwai.com/p/ABC123
        const matchP = /\/p\/([A-Za-z0-9_-]+)/.exec(urlObj.pathname);
        return matchP?.[1] || null;
      }

      case "FACEBOOK": {
        // Facebook: /videos/123456, /watch/?v=123456, /reel/123456
        const matchVideos = /\/videos\/(\d+)/.exec(urlObj.pathname);
        if (matchVideos) return matchVideos[1] || null;

        const matchWatch = urlObj.searchParams.get("v");
        if (matchWatch) return matchWatch;

        const matchReel = /\/reel\/(\d+)/.exec(urlObj.pathname);
        return matchReel?.[1] || null;
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`Erro ao extrair platformVideoId da URL ${url}:`, error);
    return null;
  }
}

/**
 * Template de email de aprovação e verificação do clipper
 */
function getVerificationEmailTemplate(
  clipperName: string,
  artisticName?: string | null,
) {
  const displayName = artisticName || clipperName;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você foi aprovado na Clipfy League! 🎉</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 50%, #14F7FF 100%); padding: 32px 24px; text-align: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"40\" fill=\"rgba(255,255,255,0.05)\"/></svg>') repeat; opacity: 0.1;"></div>
      <div style="position: relative; z-index: 1;">
        <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 900; color: #000000; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">
          🎉 PARABÉNS!
        </h1>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #000000;">
          Você foi APROVADO na Clipfy League!
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 24px; background: #0a0a0a;">
      
      <!-- Greeting -->
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 16px 0; font-size: 18px; color: #ffffff; font-weight: 600;">
          Olá, <span style="background: linear-gradient(135deg, #14F7FF, #37FF9F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 900;">${displayName}</span>! 🚀
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
          É com grande alegria que informamos: <strong style="color: #14F7FF;">sua conta foi verificada e aprovada</strong>! 🎊
        </p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
          Agora você faz parte da <strong style="color: #ffffff;">maior liga de clippers do Brasil</strong> e pode começar a competir, ganhar prêmios incríveis e transformar suas habilidades em resultados reais!
        </p>
      </div>

      <!-- What's Next -->
      <div style="background: linear-gradient(135deg, #14F7FF15 0%, #37FF9F15 100%); border: 2px solid #14F7FF40; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #14F7FF; text-align: center;">
          🎯 O que fazer agora?
        </h2>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">1.</span>
            <strong style="color: #ffffff;">Explore as competições ativas</strong> e inscreva-se nas que mais combinar com você
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 900;">2.</span>
            <strong style="color: #ffffff;">Envie seus melhores clipes</strong> e mostre todo o seu talento
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">3.</span>
            <strong style="color: #ffffff;">Acompanhe seu ranking</strong> em tempo real e veja como está performando
          </li>
          <li style="margin-bottom: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 900;">4.</span>
            <strong style="color: #ffffff;">Ganhe prêmios diários e mensais</strong> conforme sua performance
          </li>
        </ul>
      </div>

      <!-- Benefits -->
      <div style="background: #111111; border-left: 4px solid #37FF9F; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: #37FF9F;">
          ✨ Benefícios Exclusivos
        </h3>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 8px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Prêmios em dinheiro <strong style="color: #ffffff;">diários e mensais</strong>
          </li>
          <li style="margin-bottom: 8px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Bônus de <strong style="color: #ffffff;">R$ 100 por vídeo com +1M de views</strong>
          </li>
          <li style="margin-bottom: 8px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Dashboard completo com <strong style="color: #ffffff;">métricas em tempo real</strong>
          </li>
          <li style="margin-bottom: 8px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Acesso a <strong style="color: #ffffff;">competições exclusivas</strong>
          </li>
          <li style="margin-bottom: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Comunidade ativa de <strong style="color: #ffffff;">clippers profissionais</strong>
          </li>
        </ul>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://league.clipfyai.com/my-competitions/schedule" 
           target="_blank" 
           style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 18px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.4);">
          🚀 VER COMPETIÇÕES DISPONÍVEIS
        </a>
      </div>

      <!-- Tips -->
      <div style="background: #0d0d0d; border: 1px solid #222222; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #ffffff;">
          💡 Dicas para ter sucesso:
        </h3>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Poste com consistência e siga as regras da competição
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Use SEMPRE as hashtags e menções obrigatórias
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Acompanhe seu ranking diariamente
          </li>
          <li style="margin-bottom: 0; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Engaje com a comunidade e aprenda com outros clippers
          </li>
        </ul>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; background: #0a0a0a; border-top: 1px solid #222222;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #888888;">
        Siga a Clipfy League nas redes sociais:
      </p>
      <div style="margin: 0 0 20px 0;">
        <a href="https://tiktok.com/@clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #14F7FF; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          🎵 TikTok
        </a>
        <a href="https://instagram.com/clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #37FF9F; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          📸 Instagram
        </a>
      </div>
      <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.6;">
        © ${new Date().getFullYear()} Clipfy League - Todos os direitos reservados<br/>
        <a href="https://league.clipfyai.com/terms-of-use" target="_blank" style="color: #14F7FF; text-decoration: none;">Termos de Uso</a> | 
        <a href="https://league.clipfyai.com/rules" target="_blank" style="color: #14F7FF; text-decoration: none;">Regras</a>
      </p>
    </div>

  </div>
</body>
</html>
`;
}

export const clipperRouter = createTRPCRouter({
  canUseSocialIntegrations: privateProcedure.query(({ ctx }) => {
    return canUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });
  }),

  // Buscar todos os clippers
  // Somente ADMIN: lista de todos os clipadores (devolve cpf, telefone e chave PIX).
  getAll: adminProcedure
    .input(
      z.object({
        status: z
          .enum([
            "VERIFIED",
            "PENDING",
            "UNVERIFIED",
            "REJECTED",
            "BANNED",
            "ALL",
          ])
          .optional()
          .default("ALL"),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};

      // Filtrar por status
      if (input.status && input.status !== "ALL") {
        where.verificationStatus = input.status;
      }

      // Filtrar por busca (nome, nome artístico, email ou username de contas sociais)
      if (input.search && input.search.trim() !== "") {
        const searchTerm = input.search.trim();

        // Buscar clipper profiles que correspondem ao termo de busca
        where.OR = [
          { fullName: { contains: searchTerm, mode: "insensitive" } },
          { artisticName: { contains: searchTerm, mode: "insensitive" } },
          {
            user: {
              email: { contains: searchTerm, mode: "insensitive" },
            },
          },
        ];
      }

      const clippers = await ctx.db.clipperProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              imageUrl: true,
              subscriptionStatus: true,
            },
          },
          socialAccounts: {
            select: {
              id: true,
              platform: true,
              username: true,
            },
          },
          wallet: {
            select: {
              totalEarned: true,
              balance: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Se houver busca por username, filtrar também por Social Accounts
      if (input.search && input.search.trim() !== "") {
        const searchTerm = input.search.trim().toLowerCase();

        // Buscar também clipper profiles que têm Social Accounts com o username
        const clippersWithSocialAccounts = await ctx.db.clipperProfile.findMany(
          {
            where: {
              socialAccounts: {
                some: {
                  username: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
              },
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  imageUrl: true,
                  subscriptionStatus: true,
                },
              },
              socialAccounts: {
                select: {
                  id: true,
                  platform: true,
                  username: true,
                },
              },
              wallet: {
                select: {
                  totalEarned: true,
                  balance: true,
                },
              },
            },
          },
        );

        // Combinar resultados e remover duplicatas
        const allClippers = [...clippers, ...clippersWithSocialAccounts];
        const uniqueClippers = Array.from(
          new Map(allClippers.map((c) => [c.id, c])).values(),
        );

        return uniqueClippers;
      }

      return clippers;
    }),

  // Buscar um clipper por ID
  // Somente ADMIN: perfil completo de um clipador (cpf, telefone, chave PIX).
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              imageUrl: true,
              name: true,
              createdAt: true,
            },
          },
        },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipper não encontrado",
        });
      }

      return clipper;
    }),

  // Buscar Social Accounts de um clipper
  // Somente ADMIN: contas sociais de um clipador qualquer.
  getClipperSocialAccounts: adminProcedure
    .input(z.object({ clipperProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const socialAccounts = await ctx.db.socialAccount.findMany({
        where: {
          clipperProfileId: input.clipperProfileId,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      });

      return socialAccounts;
    }),

  // Estatísticas dos clippers
  // Somente ADMIN: estatísticas agregadas de clipadores.
  getStats: adminProcedure.query(async ({ ctx }) => {
    const [verified, pending, unverified, rejected, total, activeSubscribers] =
      await Promise.all([
        ctx.db.clipperProfile.count({
          where: { verificationStatus: "VERIFIED" },
        }),
        ctx.db.clipperProfile.count({
          where: { verificationStatus: "PENDING" },
        }),
        ctx.db.clipperProfile.count({
          where: { verificationStatus: "UNVERIFIED" },
        }),
        ctx.db.clipperProfile.count({
          where: { verificationStatus: "REJECTED" },
        }),
        ctx.db.clipperProfile.count(),
        // Contar TODOS os assinantes PRO ativos (independente de ter ClipperProfile)
        ctx.db.user.count({
          where: {
            subscriptionStatus: "ACTIVE",
          },
        }),
      ]);

    // Calcular total de views e posts (quando houver dados reais)
    // Por enquanto retornamos 0
    const totalViews = 0;
    const totalPosts = 0;

    return {
      verified,
      pending,
      unverified,
      rejected,
      total,
      totalViews,
      totalPosts,
      activeSubscribers,
    };
  }),

  getOverviewData: adminProcedure.query(async ({ ctx }) => {
    const [
      totalClippers,
      verifiedClippers,
      pendingClippers,
      rejectedClippers,
      stateDistribution,
      nicheDistribution,
      platformDistribution,
      recentClippers,
      monthlyGrowth,
      totalPostsAgg,
      totalViewsAgg,
      proSubscribers,
    ] = await Promise.all([
      ctx.db.clipperProfile.count(),
      ctx.db.clipperProfile.count({
        where: { verificationStatus: "VERIFIED" },
      }),
      ctx.db.clipperProfile.count({ where: { verificationStatus: "PENDING" } }),
      ctx.db.clipperProfile.count({
        where: { verificationStatus: "REJECTED" },
      }),
      ctx.db.clipperProfile.groupBy({
        by: ["state"],
        _count: { id: true },
        where: { state: { not: "" } },
        orderBy: { _count: { id: "desc" } },
      }),
      ctx.db.socialAccount.groupBy({
        by: ["niche"],
        _count: { niche: true },
        where: { niche: { not: null } },
        orderBy: { _count: { niche: "desc" } },
        take: 10,
      }),
      ctx.db.socialAccount.groupBy({
        by: ["platform"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      ctx.db.clipperProfile.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          artisticName: true,
          state: true,
          city: true,
          verificationStatus: true,
          createdAt: true,
          user: { select: { imageUrl: true } },
        },
      }),
      ctx.db.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*)::bigint as count
        FROM "ClipperProfile"
        WHERE "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
        ORDER BY month ASC
      `,
      ctx.db.clipPost.aggregate({ _count: { id: true } }),
      ctx.db.clipPost.aggregate({ _sum: { views: true } }),
      ctx.db.user.count({ where: { subscriptionStatus: "ACTIVE" } }),
    ]);

    return {
      totalClippers,
      verifiedClippers,
      pendingClippers,
      rejectedClippers,
      stateDistribution: stateDistribution.map((s) => ({
        state: s.state,
        count: s._count.id,
      })),
      nicheDistribution: nicheDistribution.map((n) => ({
        niche: n.niche || "OUTRO",
        count: n._count?.niche ?? 0,
      })),
      platformDistribution: platformDistribution.map((p) => ({
        platform: p.platform,
        count: p._count.id,
      })),
      recentClippers,
      monthlyGrowth: monthlyGrowth.map((m) => ({
        month: m.month,
        count: Number(m.count),
      })),
      totalPosts: totalPostsAgg._count.id,
      totalViews: Number(totalViewsAgg._sum.views || 0),
      proSubscribers,
    };
  }),

  getCityViewsRanking: adminProcedure.query(async ({ ctx }) => {
    const cities = await ctx.db.$queryRaw<
      {
        city: string;
        state: string;
        clipper_count: bigint;
        total_views: bigint;
        total_posts: bigint;
      }[]
    >`
      SELECT
        cp."city",
        cp."state",
        COUNT(DISTINCT cp."id")::bigint as clipper_count,
        COALESCE(SUM(p."views"), 0)::bigint as total_views,
        COUNT(p."id")::bigint as total_posts
      FROM "ClipperProfile" cp
      LEFT JOIN "ClipperApplication" ca ON ca."clipperProfileId" = cp."id"
      LEFT JOIN "ClipPost" p ON p."applicationId" = ca."id"
      WHERE cp."city" IS NOT NULL AND cp."city" != ''
      GROUP BY cp."city", cp."state"
      ORDER BY total_views DESC
      LIMIT 20
    `;

    return cities.map((c, i) => ({
      position: i + 1,
      city: c.city,
      state: c.state,
      clipperCount: Number(c.clipper_count),
      totalViews: Number(c.total_views),
      totalPosts: Number(c.total_posts),
    }));
  }),

  // Verificar clipper
  // Somente ADMIN: aprovar clipador.
  verify: adminProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar clipper com dados do usuário
        const clipper = await ctx.db.clipperProfile.findUnique({
          where: { id: input.id },
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        });

        if (!clipper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Clipper não encontrado",
          });
        }

        // Verificar se já está verificado
        if (clipper.verificationStatus === "VERIFIED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Este clipper já está verificado",
          });
        }

        // Atualizar status do clipper
        const updatedClipper = await ctx.db.clipperProfile.update({
          where: { id: input.id },
          data: {
            verificationStatus: "VERIFIED",
            verifiedAt: new Date(),
          },
        });

        // Enviar email de aprovação (não bloquear a resposta)
        if (clipper.user?.email) {
          resend.emails
            .send({
              from: "Clipfy League <noreply@clipfyai.com>",
              to: clipper.user.email,
              subject: "🎉 Parabéns! Você foi aprovado na Clipfy League!",
              html: getVerificationEmailTemplate(
                clipper.fullName,
                clipper.artisticName,
              ),
            })
            .then(() => {
              console.log(
                `✅ Email de verificação enviado para: ${clipper.user?.email}`,
              );
            })
            .catch((error) => {
              console.error("❌ Erro ao enviar email de verificação:", error);
              // Não lançar erro para não bloquear a aprovação
            });
        }

        console.log(
          `✅ Clipper verificado: ${clipper.fullName} (${clipper.artisticName || "sem nome artístico"})`,
        );

        return updatedClipper;
      } catch (error: any) {
        console.error("Erro ao verificar clipper:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao verificar clipper",
        });
      }
    }),

  // Rejeitar clipper
  // Somente ADMIN: rejeitar clipador.
  reject: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.id },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipper não encontrado",
        });
      }

      const updatedClipper = await ctx.db.clipperProfile.update({
        where: { id: input.id },
        data: {
          verificationStatus: "REJECTED",
          verifiedAt: null,
          // Nota: rejectionReason não existe no schema, mas você pode adicionar se necessário
        },
      });

      return updatedClipper;
    }),

  // Definir status como pendente
  // Somente ADMIN: mudar status de verificação para pendente.
  setPending: adminProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.id },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipper não encontrado",
        });
      }

      const updatedClipper = await ctx.db.clipperProfile.update({
        where: { id: input.id },
        data: {
          verificationStatus: "PENDING",
          verifiedAt: null,
        },
      });

      return updatedClipper;
    }),

  // Banir clipador
  // Somente ADMIN: banir clipador.
  ban: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.id },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipper não encontrado",
        });
      }

      const updatedClipper = await ctx.db.clipperProfile.update({
        where: { id: input.id },
        data: {
          verificationStatus: "BANNED",
          verifiedAt: null,
        },
      });

      return updatedClipper;
    }),

  // Desbanir clipador (reverter para VERIFIED)
  // Somente ADMIN: desbanir clipador.
  unban: adminProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.id },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipper não encontrado",
        });
      }

      if (clipper.verificationStatus !== "BANNED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Clipper não está banido",
        });
      }

      const updatedClipper = await ctx.db.clipperProfile.update({
        where: { id: input.id },
        data: {
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
        },
      });

      return updatedClipper;
    }),

  // Definir status como não verificado
  // Somente ADMIN: mudar status de verificação para não verificado.
  setUnverified: adminProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.id },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipper não encontrado",
        });
      }

      const updatedClipper = await ctx.db.clipperProfile.update({
        where: { id: input.id },
        data: {
          verificationStatus: "UNVERIFIED",
          verifiedAt: null,
        },
      });

      return updatedClipper;
    }),

  // Atualizar clipper (para edições futuras)
  // Somente ADMIN: editar o cadastro de um clipador.
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          fullName: z.string().optional(),
          artisticName: z.string().optional(),
          phone: z.string().optional(),
          cpf: z.string().optional(),
          pixKey: z.string().optional(),
          country: z.string().optional(),
          state: z.string().optional(),
          city: z.string().optional(),
          instagramUsernames: z.array(z.string()).optional(),
          tiktokUsernames: z.array(z.string()).optional(),
          youtubeUsernames: z.array(z.string()).optional(),
          niches: z.array(z.string()).optional(),
          tools: z.array(z.string()).optional(),
          postingFrequency: z.string().optional(),
          weeklyCommitment: z.string().optional(),
          portfolioLinks: z.array(z.string()).optional(),
          bestVideoUrl: z.string().optional(),
          bestVideoViews: z.number().optional(),
          avgViews: z.number().optional(),
          avgEngagementRate: z.number().optional(),
          motivationText: z.string().optional(),
          autoScore: z.number().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.id },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipper não encontrado",
        });
      }

      const updatedClipper = await ctx.db.clipperProfile.update({
        where: { id: input.id },
        data: input.data,
      });

      return updatedClipper;
    }),

  // Buscar wallet do clipper
  getWallet: privateProcedure
    .input(z.object({ clipperProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Fora do try: um FORBIDDEN não pode ser engolido pelo catch abaixo,
      // que devolve null em qualquer erro.
      await assertCanReadClipperFinancials(
        ctx.db,
        ctx.userId,
        input.clipperProfileId,
      );

      try {
        console.log(
          "🔍 Buscando wallet para clipperProfileId:",
          input.clipperProfileId,
        );

        const wallet = await ctx.db.wallet.findUnique({
          where: { clipperProfileId: input.clipperProfileId },
        });

        console.log("💰 Wallet encontrada:", wallet ? "SIM" : "NÃO");
        if (wallet) {
          console.log("💵 Saldo:", wallet.balance);
          console.log("📊 Total Ganho:", wallet.totalEarned);
        }

        return wallet || null;
      } catch (error) {
        console.error("❌ Erro ao buscar wallet:", error);
        return null;
      }
    }),

  // Buscar transações do clipper com paginação
  getTransactions: privateProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        page: z.number().optional().default(1),
        pageSize: z.number().min(1).max(500).optional().default(10),
        type: z
          .enum([
            "PRIZE_CREDIT",
            "BONUS",
            "ADJUSTMENT",
            "WITHDRAWAL_REQUEST",
            "WITHDRAWAL_APPROVED",
            "WITHDRAWAL_REJECTED",
            "WITHDRAWAL_COMPLETED",
            "WITHDRAWAL_CANCELLED",
            "REFUND",
            "FEE",
            "ALL",
          ])
          .optional()
          .default("ALL"),
        status: z
          .enum([
            "PENDING",
            "PROCESSING",
            "COMPLETED",
            "REJECTED",
            "CANCELLED",
            "FAILED",
            "ALL",
          ])
          .optional()
          .default("ALL"),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Fora do try: um FORBIDDEN não pode ser engolido pelo catch abaixo.
      await assertCanReadClipperFinancials(
        ctx.db,
        ctx.userId,
        input.clipperProfileId,
      );

      try {
        // Buscar a wallet primeiro
        const wallet = await ctx.db.wallet.findUnique({
          where: { clipperProfileId: input.clipperProfileId },
        });

        if (!wallet) {
          return {
            transactions: [],
            total: 0,
            page: input.page,
            pageSize: input.pageSize,
            totalPages: 0,
          };
        }

        // Construir filtros
        const where: any = {
          walletId: wallet.id,
        };

        if (input.type && input.type !== "ALL") {
          where.type = input.type;
        }

        if (input.status && input.status !== "ALL") {
          where.status = input.status;
        }

        // Buscar total de transações
        const total = await ctx.db.transaction.count({ where });

        // Buscar transações com paginação
        const transactions = await ctx.db.transaction.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        });

        return {
          transactions,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize) || 0,
        };
      } catch (error) {
        console.error("Erro ao buscar transações:", error);
        return {
          transactions: [],
          total: 0,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: 0,
        };
      }
    }),

  // Estatísticas da wallet
  // O dono da carteira pode consultar as próprias estatísticas; ADMIN consulta qualquer uma.
  getWalletStats: privateProcedure
    .input(z.object({ clipperProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanReadClipperFinancials(
        ctx.db,
        ctx.userId,
        input.clipperProfileId,
      );

      try {
        const wallet = await ctx.db.wallet.findUnique({
          where: { clipperProfileId: input.clipperProfileId },
        });

        if (!wallet) {
          return {
            totalTransactions: 0,
            totalCredits: 0,
            totalCreditsCount: 0,
            totalWithdrawals: 0,
            pendingWithdrawals: 0,
            completedWithdrawals: 0,
            lastTransaction: null,
          };
        }

        const [
          totalTransactions,
          totalCredits,
          totalWithdrawals,
          pendingWithdrawals,
          completedWithdrawals,
          lastTransaction,
        ] = await Promise.all([
          ctx.db.transaction.count({
            where: { walletId: wallet.id },
          }),
          ctx.db.transaction.aggregate({
            where: {
              walletId: wallet.id,
              type: {
                in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT", "REFUND"],
              },
              status: "COMPLETED",
              amount: { gt: 0 },
            },
            _sum: {
              amount: true,
            },
            _count: {
              id: true,
            },
          }),
          ctx.db.transaction.count({
            where: {
              walletId: wallet.id,
              type: {
                in: [
                  "WITHDRAWAL_REQUEST",
                  "WITHDRAWAL_APPROVED",
                  "WITHDRAWAL_COMPLETED",
                ],
              },
            },
          }),
          ctx.db.transaction.count({
            where: {
              walletId: wallet.id,
              type: {
                in: ["WITHDRAWAL_REQUEST", "WITHDRAWAL_APPROVED"],
              },
              status: {
                in: ["PENDING", "PROCESSING"],
              },
            },
          }),
          ctx.db.transaction.count({
            where: {
              walletId: wallet.id,
              type: "WITHDRAWAL_COMPLETED",
              status: "COMPLETED",
            },
          }),
          ctx.db.transaction.findFirst({
            where: { walletId: wallet.id },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        return {
          totalTransactions,
          totalCredits: totalCredits._sum.amount || 0,
          totalCreditsCount: totalCredits._count.id,
          totalWithdrawals,
          pendingWithdrawals,
          completedWithdrawals,
          lastTransaction,
        };
      } catch (error) {
        console.error("Erro ao buscar estatísticas da wallet:", error);
        return {
          totalTransactions: 0,
          totalCredits: 0,
          totalCreditsCount: 0,
          totalWithdrawals: 0,
          pendingWithdrawals: 0,
          completedWithdrawals: 0,
          lastTransaction: null,
        };
      }
    }),

  // Estatísticas do dashboard do clipper
  getDashboardStats: privateProcedure.query(async ({ ctx }) => {
    try {
      // Buscar o perfil do clipper do usuário atual
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        include: {
          wallet: true,
        },
      });

      if (!clipperProfile) {
        return {
          activeCompetitions: 0,
          totalViews: 0,
          totalEarned: 0,
          averageRanking: 0,
          viewsGrowth: 0,
          competitionsGrowth: 0,
          earningsGrowth: 0,
          rankingChange: 0,
        };
      }

      // Buscar aplicações aprovadas (competições ativas)
      const activeApplications = await ctx.db.clipperApplication.findMany({
        where: {
          clipperProfileId: clipperProfile.id,
          status: "APPROVED",
          campaign: {
            status: {
              in: ["ACTIVE", "SCHEDULED"],
            },
          },
        },
        include: {
          campaign: true,
        },
      });

      // Buscar todos os posts do clipper
      const clipPosts = await ctx.db.clipPost.findMany({
        where: {
          application: {
            clipperProfileId: clipperProfile.id,
          },
          status: "ELIGIBLE",
        },
        select: {
          views: true,
          campaignId: true,
        },
      });

      // Calcular total de views
      const totalViews = clipPosts.reduce(
        (sum, post) => sum + Number(post.views),
        0,
      );

      // Total ganho (da wallet)
      const totalEarned = clipperProfile.wallet?.totalEarned || 0;

      // Buscar rankings mensais atuais (um por campanha)
      const applications = await ctx.db.clipperApplication.findMany({
        where: {
          clipperProfileId: clipperProfile.id,
          status: "APPROVED",
        },
        select: {
          id: true,
          campaignId: true,
        },
      });

      const rankings = await Promise.all(
        applications.map(async (app) => {
          return ctx.db.monthlyRankingEntry.findFirst({
            where: {
              applicationId: app.id,
            },
            orderBy: {
              lastUpdated: "desc",
            },
            select: {
              position: true,
              previousPosition: true,
              monthlyRanking: {
                select: {
                  campaignId: true,
                },
              },
            },
          });
        }),
      );

      const validRankings = rankings.filter((r) => r !== null);

      // Calcular ranking médio (melhor posição por campanha)
      const bestRankingsPerCampaign = new Map<string, number>();
      validRankings.forEach((ranking) => {
        if (!ranking) return;
        const campaignId = ranking.monthlyRanking.campaignId;
        const current = bestRankingsPerCampaign.get(campaignId);
        if (!current || ranking.position < current) {
          bestRankingsPerCampaign.set(campaignId, ranking.position);
        }
      });

      const averageRanking =
        bestRankingsPerCampaign.size > 0
          ? Array.from(bestRankingsPerCampaign.values()).reduce(
              (sum, pos) => sum + pos,
              0,
            ) / bestRankingsPerCampaign.size
          : 0;

      // Calcular mudança de ranking (média de previousPosition - position)
      const rankingChanges = validRankings
        .filter((r) => r && r.previousPosition !== null)
        .map((r) => r!.previousPosition! - r!.position);
      const rankingChange =
        rankingChanges.length > 0
          ? rankingChanges.reduce((sum, change) => sum + change, 0) /
            rankingChanges.length
          : 0;

      // Para crescimentos, precisaríamos de dados históricos
      // Por enquanto, retornar 0 ou calcular de forma simplificada
      const viewsGrowth = 0; // TODO: Implementar cálculo real com histórico
      const competitionsGrowth = 0; // TODO: Implementar cálculo real
      const earningsGrowth = 0; // TODO: Implementar cálculo real com histórico

      return {
        activeCompetitions: activeApplications.length,
        totalViews,
        totalEarned,
        averageRanking: Math.round(averageRanking),
        viewsGrowth,
        competitionsGrowth,
        earningsGrowth,
        rankingChange: Math.round(rankingChange),
      };
    } catch (error) {
      console.error("Erro ao buscar estatísticas do dashboard:", error);
      return {
        activeCompetitions: 0,
        totalViews: 0,
        totalEarned: 0,
        averageRanking: 0,
        viewsGrowth: 0,
        competitionsGrowth: 0,
        earningsGrowth: 0,
        rankingChange: 0,
      };
    }
  }),

  getClipperViewGrowth: privateProcedure
    .input(
      z
        .object({
          campaignId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          return { growthData: [], growthPlatforms: [] as string[] };
        }

        const applications = await ctx.db.clipperApplication.findMany({
          where: {
            clipperProfileId: clipperProfile.id,
            status: "APPROVED",
            ...(input?.campaignId ? { campaignId: input.campaignId } : {}),
            campaign: { status: { in: ["ACTIVE", "SCHEDULED"] } },
          },
          select: {
            id: true,
            campaignId: true,
            campaign: { select: { startDate: true, endDate: true } },
          },
        });

        if (applications.length === 0) {
          return { growthData: [], growthPlatforms: [] as string[] };
        }

        const earliestStart = new Date(
          Math.min(...applications.map((a) => a.campaign.startDate.getTime())),
        );
        earliestStart.setHours(0, 0, 0, 0);

        const latestEnd = new Date(
          Math.max(...applications.map((a) => a.campaign.endDate.getTime())),
        );
        const now = new Date();
        const effectiveEnd = latestEnd < now ? latestEnd : now;
        effectiveEnd.setHours(23, 59, 59, 999);

        const appIds = applications.map((a) => a.id);

        const [postsInRange, allPlatforms] = await Promise.all([
          ctx.db.clipPost.findMany({
            where: {
              applicationId: { in: appIds },
              status: "ELIGIBLE",
              createdAt: { gte: earliestStart, lte: effectiveEnd },
            },
            select: { platform: true, views: true, createdAt: true },
          }),
          ctx.db.clipPost.groupBy({
            by: ["platform"],
            where: {
              applicationId: { in: appIds },
              status: "ELIGIBLE",
            },
            _sum: { views: true },
          }),
        ]);

        const growthPlatforms = allPlatforms.map((p) => p.platform).sort();

        const totalDays =
          Math.ceil(
            (effectiveEnd.getTime() - earliestStart.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        const dayMap = new Map<string, Record<string, number>>();
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(earliestStart);
          d.setDate(d.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          const row: Record<string, number> = { total: 0 };
          growthPlatforms.forEach((p) => (row[p] = 0));
          dayMap.set(key, row);
        }

        for (const post of postsInRange) {
          const key = post.createdAt.toISOString().slice(0, 10);
          const row = dayMap.get(key);
          if (!row) continue;
          const views = Number(post.views || 0);
          row.total = (row.total || 0) + views;
          row[post.platform] = (row[post.platform] || 0) + views;
        }

        const cumTotals: Record<string, number> = {};
        growthPlatforms.forEach((p) => (cumTotals[p] = 0));
        let cumTotal = 0;

        const growthData = Array.from(dayMap.entries()).map(([date, row]) => {
          cumTotal += row.total || 0;
          const entry: Record<string, number | string> = { total: cumTotal };
          for (const p of growthPlatforms) {
            cumTotals[p] = (cumTotals[p] || 0) + (row[p] || 0);
            entry[p] = cumTotals[p]!;
          }
          return { date, ...entry };
        });

        return { growthData, growthPlatforms };
      } catch (error) {
        console.error("Erro ao buscar crescimento de views do clipper:", error);
        return { growthData: [], growthPlatforms: [] as string[] };
      }
    }),

  // Buscar competições ativas do clipper (para enviar posts)
  getMyCompetitions: privateProcedure.query(async ({ ctx }) => {
    try {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        return [];
      }

      const applications = await ctx.db.clipperApplication.findMany({
        where: {
          clipperProfileId: clipperProfile.id,
          status: "APPROVED",
          campaign: {
            status: {
              in: ["ACTIVE", "SCHEDULED"],
            },
          },
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              slug: true,
              coverImageUrl: true,
              startDate: true,
              endDate: true,
              platforms: true,
              prizeInfo: true,
              status: true,
              rankingMetricType: true,
              isProOnly: true,
            },
          },
          clipPosts: {
            where: {
              status: "ELIGIBLE",
            },
            select: {
              views: true,
            },
          },
        },
      });

      if (applications.length === 0) return [];

      const applicationIds = applications.map((a) => a.id);
      const campaignIds = [...new Set(applications.map((a) => a.campaignId))];

      // Batch: substituir N×2 queries por 2 queries paralelas
      const [rankings, participantCounts] = await Promise.all([
        ctx.db.monthlyRankingEntry.findMany({
          where: { applicationId: { in: applicationIds } },
          orderBy: [{ position: "asc" }, { lastUpdated: "desc" }],
          distinct: ["applicationId"],
          select: { applicationId: true, position: true },
        }),
        ctx.db.clipperApplication.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: campaignIds }, status: "APPROVED" },
          _count: { id: true },
        }),
      ]);

      const rankingByApp = new Map(rankings.map((r) => [r.applicationId, r]));
      const participantCountMap = new Map(
        participantCounts.map((r) => [r.campaignId, r._count.id]),
      );

      const now = new Date();

      const competitionsWithRankings = applications.map((app) => {
        const bestRanking = rankingByApp.get(app.id);
        const totalParticipants = participantCountMap.get(app.campaignId) ?? 0;

        const myViews = app.clipPosts.reduce(
          (sum, post) => sum + Number(post.views),
          0,
        );

        const endDate = new Date(app.campaign.endDate);
        const daysLeft = Math.max(
          0,
          Math.ceil(
            (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );

        const totalPrize =
          app.campaign.prizeInfo &&
          typeof app.campaign.prizeInfo === "object" &&
          "total" in app.campaign.prizeInfo
            ? typeof app.campaign.prizeInfo.total === "object"
              ? "R$ 0"
              : String(app.campaign.prizeInfo.total)
            : "R$ 0";

        return {
          id: app.campaign.id,
          name: app.campaign.name,
          slug: app.campaign.slug,
          status: app.campaign.status,
          coverImageUrl: app.campaign.coverImageUrl || "",
          platforms: app.campaign.platforms,
          endDate: app.campaign.endDate.toISOString(),
          prize: totalPrize,
          myRanking: bestRanking?.position || 0,
          totalParticipants,
          myPosts: app.clipPosts.length,
          myViews,
          potentialPrize: "R$ 0",
          daysLeft,
          rankingMetricType: app.campaign.rankingMetricType,
          isProOnly: app.campaign.isProOnly,
        };
      });

      return competitionsWithRankings;
    } catch (error) {
      console.error("Erro ao buscar competições do clipper:", error);
      return [];
    }
  }),

  // Solicitar saque
  requestWithdrawal: privateProcedure
    .input(
      z.object({
        amount: z
          .number()
          .min(50, "Valor mínimo de R$ 50")
          .int("Apenas valores inteiros"),
        withdrawalMethod: z
          .enum(["PIX", "BANK_TRANSFER", "PAYPAL", "OTHER"])
          .default("PIX"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar perfil do clipper
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
          include: {
            wallet: true,
          },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        if (!clipperProfile.wallet) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Carteira não encontrada",
          });
        }

        const wallet = clipperProfile.wallet;

        // Verificar saldo disponível
        if (wallet.balance < input.amount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Saldo insuficiente",
          });
        }

        // Criar transação de saque
        const transaction = await ctx.db.transaction.create({
          data: {
            walletId: wallet.id,
            type: "WITHDRAWAL_REQUEST",
            status: "PROCESSING",
            amount: -input.amount,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance - input.amount,
            description: `Solicitação de Saque - ${input.withdrawalMethod}`,
            withdrawalMethod: input.withdrawalMethod,
            withdrawalDetails: {
              pixKey: clipperProfile.pixKey,
            },
          },
        });

        // Atualizar saldo da wallet
        await ctx.db.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: wallet.balance - input.amount,
            pendingWithdraw: wallet.pendingWithdraw + input.amount,
          },
        });

        return transaction;
      } catch (error) {
        console.error("Erro ao solicitar saque:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao solicitar saque",
        });
      }
    }),

  // Dados de crescimento mensal (para gráfico de linha)
  getGrowthData: privateProcedure
    .input(
      z.object({
        months: z.number().min(1).max(12).default(6),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          return [];
        }

        // Calcular data inicial
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - input.months);

        // Buscar métricas históricas dos posts do clipper
        const metricsHistory = await ctx.db.clipPostMetrics.findMany({
          where: {
            clipPost: {
              application: {
                clipperProfileId: clipperProfile.id,
              },
            },
            collectedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            collectedAt: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
          },
          orderBy: {
            collectedAt: "asc",
          },
        });

        // Agrupar por mês
        const monthlyData: Record<
          string,
          { views: number; engagement: number }
        > = {};

        metricsHistory.forEach((metric) => {
          const date = new Date(metric.collectedAt);
          const monthKey = date.toLocaleDateString("pt-BR", {
            month: "short",
            year: "numeric",
          });

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { views: 0, engagement: 0 };
          }

          monthlyData[monthKey].views += Number(metric.views);
          monthlyData[monthKey].engagement +=
            metric.likes + metric.comments + metric.shares;
        });

        // Converter para array e formatar
        const chartData = Object.entries(monthlyData).map(([month, data]) => {
          const monthPart = month.split(" ")[0];
          const formattedMonth = monthPart
            ? monthPart.charAt(0).toUpperCase() + monthPart.slice(1)
            : "";

          return {
            month: formattedMonth,
            views: data.views,
            engagement: data.engagement,
          };
        });

        // Se não houver dados, criar estrutura vazia para os últimos N meses
        if (chartData.length === 0) {
          const emptyData = [];
          for (let i = input.months - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            emptyData.push({
              month:
                date
                  .toLocaleDateString("pt-BR", { month: "short" })
                  .charAt(0)
                  .toUpperCase() +
                date.toLocaleDateString("pt-BR", { month: "short" }).slice(1),
              views: 0,
              engagement: 0,
            });
          }
          return emptyData;
        }

        return chartData;
      } catch (error) {
        console.error("Erro ao buscar dados de crescimento:", error);
        return [];
      }
    }),

  // Dados de distribuição por plataforma (para gráfico de barras)
  getPlatformDistribution: privateProcedure.query(async ({ ctx }) => {
    try {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        return [];
      }

      // Buscar distribuição de posts por plataforma
      const platformStats = await ctx.db.clipPost.groupBy({
        by: ["platform"],
        where: {
          application: {
            clipperProfileId: clipperProfile.id,
          },
          status: "ELIGIBLE",
        },
        _count: {
          id: true,
        },
      });

      // Formatar dados para o gráfico
      const chartData = platformStats.map((stat) => ({
        platform: stat.platform,
        posts: stat._count.id,
        clippers: 1, // Como é do próprio clipper, sempre 1
      }));

      // Se não houver dados, retornar estrutura vazia
      if (chartData.length === 0) {
        return [
          { platform: "INSTAGRAM", posts: 0, clippers: 0 },
          { platform: "TIKTOK", posts: 0, clippers: 0 },
          { platform: "YOUTUBE", posts: 0, clippers: 0 },
        ];
      }

      // Garantir que todas as plataformas apareçam
      const allPlatforms = [
        "INSTAGRAM",
        "TIKTOK",
        "YOUTUBE",
        "KWAI",
        "FACEBOOK",
      ];
      const completeData = allPlatforms.map((platform) => {
        const existing = chartData.find((d) => d.platform === platform);
        return existing || { platform, posts: 0, clippers: 0 };
      });

      return completeData;
    } catch (error) {
      console.error("Erro ao buscar distribuição por plataforma:", error);
      return [];
    }
  }),

  // Buscar contas sociais do clipper
  getMySocialAccounts: privateProcedure.query(async ({ ctx }) => {
    try {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        include: {
          socialAccounts: {
            include: {
              youtubeAuth: {
                select: {
                  id: true,
                  channelId: true,
                  channelTitle: true,
                  channelUrl: true,
                  thumbnailUrl: true,
                  status: true,
                  lastSyncAt: true,
                  errorMessage: true,
                  createdAt: true,
                  updatedAt: true,
                  syncLogs: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                      videosProcessed: true,
                      videosUpdated: true,
                      videosFailed: true,
                      errorMessage: true,
                      startedAt: true,
                      completedAt: true,
                      createdAt: true,
                    },
                  },
                },
              },
              instagramAuth: {
                select: {
                  id: true,
                  igUserId: true,
                  username: true,
                  accountType: true,
                  profilePictureUrl: true,
                  followersCount: true,
                  mediaCount: true,
                  isActive: true,
                  status: true,
                  scope: true,
                  expiresAt: true,
                  lastSyncAt: true,
                  lastError: true,
                  createdAt: true,
                  updatedAt: true,
                  syncLogs: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                      videosProcessed: true,
                      videosUpdated: true,
                      videosFailed: true,
                      commentsFetched: true,
                      commentsNew: true,
                      errorMessage: true,
                      startedAt: true,
                      completedAt: true,
                      createdAt: true,
                    },
                  },
                },
              },
              tiktokAuth: {
                select: {
                  id: true,
                  openId: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                  scope: true,
                  expiresAt: true,
                  refreshExpiresAt: true,
                  lastSyncAt: true,
                  errorMessage: true,
                  createdAt: true,
                  updatedAt: true,
                  syncLogs: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                      videosProcessed: true,
                      videosUpdated: true,
                      videosFailed: true,
                      errorMessage: true,
                      startedAt: true,
                      completedAt: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          },
        },
      });

      if (!clipperProfile) {
        return [];
      }

      return clipperProfile.socialAccounts;
    } catch (error) {
      console.error("Erro ao buscar contas sociais:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível carregar as contas sociais.",
        cause: error,
      });
    }
  }),

  // Adicionar conta social
  addSocialAccount: privateProcedure
    .input(
      z.object({
        platform: z.enum([
          "INSTAGRAM",
          "TIKTOK",
          "YOUTUBE",
          "KWAI",
          "FACEBOOK",
        ]),
        username: z.string().min(1, "Username é obrigatório"),
        profileUrl: z.string().optional(),
        niche: z
          .enum([
            "MOTIVATIONAL",
            "GOSSIP",
            "MEME",
            "ENTREPRENEURSHIP",
            "HUMOR",
            "GAMING",
            "SPORTS",
            "MUSIC",
            "EDUCATION",
            "NEWS",
            "POLITICS",
            "LIFESTYLE",
            "FITNESS",
            "FASHION",
            "BEAUTY",
            "FOOD",
            "TRAVEL",
            "TECH",
            "FINANCE",
            "RELIGION",
            "ENTERTAINMENT",
            "HOT",
            "FAMILY",
            "MATERNITY",
            "PATERNITY",
            "MARRIAGE",
            "BODYBUILDING",
            "WOMEN",
            "MEN",
            "COUPLE",
            "PETS",
            "CARS",
            "MOTORCYCLES",
            "ANIME",
            "KPOP",
            "DANCE",
            "COMEDY",
            "DRAMA",
            "ASTROLOGY",
            "PSYCHOLOGY",
            "SELF_HELP",
            "PRODUCTIVITY",
            "MARKETING",
            "SALES",
            "REAL_ESTATE",
            "CRYPTO",
            "INVESTING",
            "DIY",
            "ART",
            "PHOTOGRAPHY",
            "CINEMA",
            "SERIES",
            "BOOKS",
            "PODCAST",
            "ASMR",
            "NATURE",
            "SUSTAINABILITY",
            "HEALTH",
            "MENTAL_HEALTH",
            "NUTRITION",
            "VEGAN",
            "WINE",
            "COFFEE",
            "BEER",
            "COOKING",
            "CONFECTIONERY",
            "DECORATION",
            "ARCHITECTURE",
            "GARDEN",
            "CLEANING",
            "ORGANIZATION",
            "PARENTING",
            "BABY",
            "KIDS",
            "TEENS",
            "SCHOOL",
            "UNIVERSITY",
            "LANGUAGES",
            "LAW",
            "MEDICINE",
            "ENGINEERING",
            "SCIENCE",
            "HISTORY",
            "PHILOSOPHY",
            "SOCIOLOGY",
            "ECONOMY",
            "MILITARY",
            "POLICE",
            "FIREFIGHTER",
            "TRUCKER",
            "RURAL",
            "AGRIBUSINESS",
            "FISHING",
            "HUNTING",
            "SURF",
            "SKATE",
            "CROSSFIT",
            "YOGA",
            "PILATES",
            "RUNNING",
            "CYCLING",
            "SWIMMING",
            "MARTIAL_ARTS",
            "BOXING",
            "SOCCER",
            "BASKETBALL",
            "VOLLEYBALL",
            "TENNIS",
            "GOLF",
            "ESPORTS",
            "STREAMER",
            "COSPLAY",
            "TATTOO",
            "PIERCING",
            "NAILS",
            "HAIR",
            "SKINCARE",
            "MAKEUP",
            "PLUS_SIZE",
            "LUXURY",
            "MINIMALISM",
            "VINTAGE",
            "STREETWEAR",
            "SNEAKERS",
            "JEWELRY",
            "WATCHES",
            "HANDBAGS",
            "WEDDING",
            "PARTY",
            "EVENTS",
            "CARNIVAL",
            "FUNK",
            "SERTANEJO",
            "RAP",
            "ROCK",
            "POP",
            "ELECTRONIC",
            "GOSPEL",
            "PAGODE",
            "FORRO",
            "MPB",
            "REGGAE",
            "JAZZ",
            "CLASSICAL",
            "COUNTRY",
            "TRAP",
            "LGBTQ",
            "DIVERSITY",
            "FEMINISM",
            "ACTIVISM",
            "CHARITY",
            "VOLUNTEERING",
            "SPIRITUAL",
            "MEDITATION",
            "TAROT",
            "NUMEROLOGY",
            "CONSPIRACY",
            "TRUE_CRIME",
            "HORROR",
            "PARANORMAL",
            "RIDDLES",
            "TRIVIA",
            "CHALLENGES",
            "PRANKS",
            "REACTIONS",
            "UNBOXING",
            "REVIEWS",
            "TUTORIALS",
            "TIPS",
            "HACKS",
            "STORYTIME",
            "CONFESSIONS",
            "RELATIONSHIPS",
            "DATING",
            "BREAKUP",
            "FRIENDSHIP",
            "BULLYING",
            "MENTAL_WELLNESS",
            "THERAPY",
            "ADHD",
            "AUTISM",
            "DISABILITY",
            "ACCESSIBILITY",
            "SIGN_LANGUAGE",
            "IMMIGRATION",
            "EXPAT",
            "NOMAD",
            "BACKPACKING",
            "CAMPING",
            "HIKING",
            "BEACH",
            "MOUNTAIN",
            "FARM",
            "CITY",
            "INTERIOR",
            "FAVELA",
            "PERIFERIAS",
            "NORDESTE",
            "AMAZONIA",
            "OTHER",
          ])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        // Limpar username: remover @ e espaços
        const cleanUsername = input.username
          .replace(/@/g, "")
          .replace(/\s/g, "")
          .trim();

        if (!cleanUsername) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Username inválido",
          });
        }

        // Adicionar @ no início
        const formattedUsername = `@${cleanUsername}`;

        // Verificar se já existe uma conta com mesmo username e plataforma
        const existingAccount = await ctx.db.socialAccount.findFirst({
          where: {
            clipperProfileId: clipperProfile.id,
            platform: input.platform,
            username: formattedUsername,
          },
        });

        if (existingAccount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta conta já está cadastrada",
          });
        }

        // Criar nova conta
        const newAccount = await ctx.db.socialAccount.create({
          data: {
            clipperProfileId: clipperProfile.id,
            platform: input.platform,
            username: formattedUsername,
            profileUrl: input.profileUrl,
            niche: input.niche,
            isPrimary: false,
            isVerified: false,
            isActive: true,
          },
        });

        return newAccount;
      } catch (error) {
        console.error("Erro ao adicionar conta social:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao adicionar conta social",
        });
      }
    }),

  // Atualizar conta social
  updateSocialAccount: privateProcedure
    .input(
      z.object({
        accountId: z.string(),
        username: z.string().min(1, "Username é obrigatório"),
        profileUrl: z.string().optional(),
        niche: z
          .enum([
            "MOTIVATIONAL",
            "GOSSIP",
            "MEME",
            "ENTREPRENEURSHIP",
            "HUMOR",
            "GAMING",
            "SPORTS",
            "MUSIC",
            "EDUCATION",
            "NEWS",
            "POLITICS",
            "LIFESTYLE",
            "FITNESS",
            "FASHION",
            "BEAUTY",
            "FOOD",
            "TRAVEL",
            "TECH",
            "FINANCE",
            "RELIGION",
            "ENTERTAINMENT",
            "HOT",
            "FAMILY",
            "MATERNITY",
            "PATERNITY",
            "MARRIAGE",
            "BODYBUILDING",
            "WOMEN",
            "MEN",
            "COUPLE",
            "PETS",
            "CARS",
            "MOTORCYCLES",
            "ANIME",
            "KPOP",
            "DANCE",
            "COMEDY",
            "DRAMA",
            "ASTROLOGY",
            "PSYCHOLOGY",
            "SELF_HELP",
            "PRODUCTIVITY",
            "MARKETING",
            "SALES",
            "REAL_ESTATE",
            "CRYPTO",
            "INVESTING",
            "DIY",
            "ART",
            "PHOTOGRAPHY",
            "CINEMA",
            "SERIES",
            "BOOKS",
            "PODCAST",
            "ASMR",
            "NATURE",
            "SUSTAINABILITY",
            "HEALTH",
            "MENTAL_HEALTH",
            "NUTRITION",
            "VEGAN",
            "WINE",
            "COFFEE",
            "BEER",
            "COOKING",
            "CONFECTIONERY",
            "DECORATION",
            "ARCHITECTURE",
            "GARDEN",
            "CLEANING",
            "ORGANIZATION",
            "PARENTING",
            "BABY",
            "KIDS",
            "TEENS",
            "SCHOOL",
            "UNIVERSITY",
            "LANGUAGES",
            "LAW",
            "MEDICINE",
            "ENGINEERING",
            "SCIENCE",
            "HISTORY",
            "PHILOSOPHY",
            "SOCIOLOGY",
            "ECONOMY",
            "MILITARY",
            "POLICE",
            "FIREFIGHTER",
            "TRUCKER",
            "RURAL",
            "AGRIBUSINESS",
            "FISHING",
            "HUNTING",
            "SURF",
            "SKATE",
            "CROSSFIT",
            "YOGA",
            "PILATES",
            "RUNNING",
            "CYCLING",
            "SWIMMING",
            "MARTIAL_ARTS",
            "BOXING",
            "SOCCER",
            "BASKETBALL",
            "VOLLEYBALL",
            "TENNIS",
            "GOLF",
            "ESPORTS",
            "STREAMER",
            "COSPLAY",
            "TATTOO",
            "PIERCING",
            "NAILS",
            "HAIR",
            "SKINCARE",
            "MAKEUP",
            "PLUS_SIZE",
            "LUXURY",
            "MINIMALISM",
            "VINTAGE",
            "STREETWEAR",
            "SNEAKERS",
            "JEWELRY",
            "WATCHES",
            "HANDBAGS",
            "WEDDING",
            "PARTY",
            "EVENTS",
            "CARNIVAL",
            "FUNK",
            "SERTANEJO",
            "RAP",
            "ROCK",
            "POP",
            "ELECTRONIC",
            "GOSPEL",
            "PAGODE",
            "FORRO",
            "MPB",
            "REGGAE",
            "JAZZ",
            "CLASSICAL",
            "COUNTRY",
            "TRAP",
            "LGBTQ",
            "DIVERSITY",
            "FEMINISM",
            "ACTIVISM",
            "CHARITY",
            "VOLUNTEERING",
            "SPIRITUAL",
            "MEDITATION",
            "TAROT",
            "NUMEROLOGY",
            "CONSPIRACY",
            "TRUE_CRIME",
            "HORROR",
            "PARANORMAL",
            "RIDDLES",
            "TRIVIA",
            "CHALLENGES",
            "PRANKS",
            "REACTIONS",
            "UNBOXING",
            "REVIEWS",
            "TUTORIALS",
            "TIPS",
            "HACKS",
            "STORYTIME",
            "CONFESSIONS",
            "RELATIONSHIPS",
            "DATING",
            "BREAKUP",
            "FRIENDSHIP",
            "BULLYING",
            "MENTAL_WELLNESS",
            "THERAPY",
            "ADHD",
            "AUTISM",
            "DISABILITY",
            "ACCESSIBILITY",
            "SIGN_LANGUAGE",
            "IMMIGRATION",
            "EXPAT",
            "NOMAD",
            "BACKPACKING",
            "CAMPING",
            "HIKING",
            "BEACH",
            "MOUNTAIN",
            "FARM",
            "CITY",
            "INTERIOR",
            "FAVELA",
            "PERIFERIAS",
            "NORDESTE",
            "AMAZONIA",
            "OTHER",
          ])
          .optional()
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        // Verificar se a conta pertence ao clipper
        const account = await ctx.db.socialAccount.findFirst({
          where: {
            id: input.accountId,
            clipperProfileId: clipperProfile.id,
          },
        });

        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conta não encontrada",
          });
        }

        // Limpar username: remover @ e espaços
        const cleanUsername = input.username
          .replace(/@/g, "")
          .replace(/\s/g, "")
          .trim();

        if (!cleanUsername) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Username inválido",
          });
        }

        // Adicionar @ no início
        const formattedUsername = `@${cleanUsername}`;

        // Atualizar conta
        const updatedAccount = await ctx.db.socialAccount.update({
          where: { id: input.accountId },
          data: {
            username: formattedUsername,
            profileUrl: input.profileUrl || null,
            ...(input.niche !== undefined ? { niche: input.niche } : {}),
          },
        });

        return updatedAccount;
      } catch (error) {
        console.error("Erro ao atualizar conta social:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao atualizar conta social",
        });
      }
    }),

  toggleSocialAccountActive: privateProcedure
    .input(z.object({ accountId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });
      if (!clipperProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Perfil não encontrado",
        });
      }
      const account = await ctx.db.socialAccount.findFirst({
        where: { id: input.accountId, clipperProfileId: clipperProfile.id },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta não encontrada",
        });
      }
      return ctx.db.socialAccount.update({
        where: { id: input.accountId },
        data: { isActive: input.isActive },
      });
    }),

  validatePostUrl: privateProcedure
    .input(
      z.object({
        accountId: z.string(),
        url: z.string().url("URL inválida"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Perfil de clipper não encontrado",
        });
      }

      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.accountId,
          clipperProfileId: clipperProfile.id,
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta não encontrada",
        });
      }

      let url = input.url;

      if (account.platform === "TIKTOK") {
        try {
          url = await resolveTikTokPostUrl(input.url);
        } catch (e) {
          if (e instanceof TikTokUrlResolveError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: e.message,
            });
          }
          throw e;
        }
      }

      const platformVideoId = extractPlatformVideoId(url, account.platform);

      const duplicateByUrl = await ctx.db.clipPost.findFirst({
        where: {
          submittedUrl: url,
        },
        select: {
          submittedUrl: true,
          campaign: {
            select: {
              name: true,
            },
          },
          application: {
            select: {
              clipperProfile: {
                select: {
                  fullName: true,
                  artisticName: true,
                },
              },
            },
          },
        },
      });

      if (duplicateByUrl) {
        const duplicateClipper =
          duplicateByUrl.application.clipperProfile.artisticName ||
          duplicateByUrl.application.clipperProfile.fullName;

        return {
          isDuplicate: true,
          resolvedUrl: url,
          platformVideoId,
          message: `Este link já foi enviado na competição "${duplicateByUrl.campaign.name}" por ${duplicateClipper}.`,
        };
      }

      if (platformVideoId) {
        const duplicateByVideoId = await ctx.db.clipPost.findFirst({
          where: {
            platformVideoId,
            platform: account.platform,
          },
          select: {
            submittedUrl: true,
            campaign: {
              select: {
                name: true,
              },
            },
            application: {
              select: {
                clipperProfile: {
                  select: {
                    fullName: true,
                    artisticName: true,
                  },
                },
              },
            },
          },
        });

        if (duplicateByVideoId) {
          const duplicateClipper =
            duplicateByVideoId.application.clipperProfile.artisticName ||
            duplicateByVideoId.application.clipperProfile.fullName;

          return {
            isDuplicate: true,
            resolvedUrl: url,
            platformVideoId,
            message: `Este vídeo já foi enviado na competição "${duplicateByVideoId.campaign.name}" por ${duplicateClipper}.`,
          };
        }
      }

      return {
        isDuplicate: false,
        resolvedUrl: url,
        platformVideoId,
        message: null,
      };
    }),

  // Submeter posts para uma competição
  submitPosts: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
        posts: z.array(
          z.object({
            accountId: z.string(),
            url: z.string().url("URL inválida"),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        // Verificar se o clipper tem uma application aprovada para essa campanha
        const application = await ctx.db.clipperApplication.findUnique({
          where: {
            campaignId_clipperProfileId: {
              campaignId: input.campaignId,
              clipperProfileId: clipperProfile.id,
            },
          },
          include: {
            campaign: {
              select: {
                status: true,
                platforms: true,
                requiredHashtags: true,
              },
            },
          },
        });

        if (!application) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Você não está inscrito nesta competição",
          });
        }

        if (application.status !== "APPROVED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Sua inscrição ainda não foi aprovada",
          });
        }

        if (application.campaign.status !== "ACTIVE") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Esta competição não está ativa",
          });
        }

        // Verificar se as contas sociais pertencem ao clipper
        // Usar Set para obter IDs únicos (um clipper pode enviar múltiplos posts da mesma conta)
        const accountIds = input.posts.map((p) => p.accountId);
        const uniqueAccountIds = [...new Set(accountIds)];

        const socialAccounts = await ctx.db.socialAccount.findMany({
          where: {
            id: { in: uniqueAccountIds },
            clipperProfileId: clipperProfile.id,
          },
        });

        // Comparar com IDs únicos, não com o total de posts
        if (socialAccounts.length !== uniqueAccountIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uma ou mais contas sociais não pertencem a você",
          });
        }

        // Validar contas do Facebook: devem ter profileUrl configurado
        const facebookAccountsWithoutUrl = socialAccounts.filter(
          (acc) => acc.platform === "FACEBOOK" && !acc.profileUrl,
        );

        if (facebookAccountsWithoutUrl.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Para enviar posts no Facebook, você precisa configurar o link do perfil da sua conta em 'Gerenciar Contas'. Acesse suas configurações e adicione o link completo do seu perfil do Facebook.",
          });
        }

        const postsWithResolvedUrls = await Promise.all(
          input.posts.map(async (post) => {
            const account = socialAccounts.find(
              (acc) => acc.id === post.accountId,
            );
            if (!account || account.platform !== "TIKTOK") {
              return post;
            }
            try {
              const url = await resolveTikTokPostUrl(post.url);
              return { ...post, url };
            } catch (e) {
              if (e instanceof TikTokUrlResolveError) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: e.message,
                });
              }
              throw e;
            }
          }),
        );

        // 1. Verificar se há URLs duplicadas DENTRO DO BATCH
        const urls = postsWithResolvedUrls.map((p) => p.url);
        const urlSet = new Set(urls);
        if (urlSet.size !== urls.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Você está tentando enviar o mesmo link mais de uma vez. Remova os links duplicados.",
          });
        }

        // 2. Verificar se há URLs duplicadas na plataforma INTEIRA (não apenas na campanha)
        const existingPosts = await ctx.db.clipPost.findMany({
          where: {
            submittedUrl: {
              in: urls,
            },
          },
          select: {
            submittedUrl: true,
            campaign: {
              select: {
                name: true,
              },
            },
            application: {
              select: {
                clipperProfile: {
                  select: {
                    fullName: true,
                    artisticName: true,
                  },
                },
              },
            },
          },
        });

        if (existingPosts.length > 0) {
          const duplicateUrl = existingPosts[0]?.submittedUrl;
          const duplicateCampaign = existingPosts[0]?.campaign.name;
          const duplicateClipper =
            existingPosts[0]?.application.clipperProfile.artisticName ||
            existingPosts[0]?.application.clipperProfile.fullName;

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `O link "${duplicateUrl}" já foi enviado antes na competição "${duplicateCampaign}" por ${duplicateClipper}. Links duplicados não são permitidos na plataforma.`,
          });
        }

        // 3. Verificar se há platformVideoIds duplicados (mesmo vídeo em URLs diferentes)
        const videoIdsToCheck: Array<{
          platformVideoId: string;
          platform: string;
          url: string;
        }> = [];

        for (const post of postsWithResolvedUrls) {
          const account = socialAccounts.find(
            (acc) => acc.id === post.accountId,
          );
          if (!account) continue;

          const platformVideoId = extractPlatformVideoId(
            post.url,
            account.platform,
          );
          if (platformVideoId) {
            videoIdsToCheck.push({
              platformVideoId,
              platform: account.platform,
              url: post.url,
            });
          }
        }

        // 3.1. Verificar duplicatas de videoId DENTRO DO BATCH
        const videoIdKeys = videoIdsToCheck.map(
          (v) => `${v.platform}:${v.platformVideoId}`,
        );
        const videoIdSet = new Set(videoIdKeys);
        if (videoIdSet.size !== videoIdKeys.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Você está tentando enviar o mesmo vídeo mais de uma vez (mesmo que com links diferentes). Remova os vídeos duplicados.",
          });
        }

        // 3.2. Buscar posts com os mesmos platformVideoIds e plataformas no banco
        if (videoIdsToCheck.length > 0) {
          const duplicateVideos = await Promise.all(
            videoIdsToCheck.map(async ({ platformVideoId, platform }) => {
              try {
                const existing = await ctx.db.clipPost.findFirst({
                  where: {
                    platformVideoId,
                    platform: platform as
                      | "INSTAGRAM"
                      | "TIKTOK"
                      | "YOUTUBE"
                      | "KWAI"
                      | "FACEBOOK",
                  },
                  select: {
                    submittedUrl: true,
                    campaign: {
                      select: {
                        name: true,
                      },
                    },
                    application: {
                      select: {
                        clipperProfile: {
                          select: {
                            fullName: true,
                            artisticName: true,
                          },
                        },
                      },
                    },
                  },
                });
                return existing;
              } catch (error) {
                console.error(
                  `Erro ao verificar platformVideoId ${platformVideoId}:`,
                  error,
                );
                return null;
              }
            }),
          );

          const firstDuplicate = duplicateVideos.find((v) => v !== null);
          if (firstDuplicate) {
            const duplicateCampaign = firstDuplicate.campaign.name;
            const duplicateClipper =
              firstDuplicate.application.clipperProfile.artisticName ||
              firstDuplicate.application.clipperProfile.fullName;

            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Este vídeo já foi enviado antes na competição "${duplicateCampaign}" por ${duplicateClipper}. Mesmo que o link seja diferente, o vídeo é o mesmo e não é permitido.`,
            });
          }
        }

        // Criar os posts
        const createdPosts = await Promise.all(
          postsWithResolvedUrls.map(async (post) => {
            const account = socialAccounts.find(
              (acc) => acc.id === post.accountId,
            );
            if (!account) return null;

            // Verificar se a plataforma da conta é compatível com a campanha
            if (!application.campaign.platforms.includes(account.platform)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `A plataforma ${account.platform} não é aceita nesta competição`,
              });
            }

            // Extrair platformVideoId da URL
            const platformVideoId = extractPlatformVideoId(
              post.url,
              account.platform,
            );

            if (platformVideoId) {
              console.log(
                `✅ PlatformVideoId extraído: ${platformVideoId} (${account.platform}) da URL: ${post.url}`,
              );
            } else {
              console.warn(
                `⚠️ Não foi possível extrair platformVideoId de ${account.platform}: ${post.url}`,
              );
            }

            return await ctx.db.clipPost.create({
              data: {
                campaignId: input.campaignId,
                applicationId: application.id,
                platform: account.platform,
                submittedUrl: post.url,
                normalizedUrl:
                  account.platform === "TIKTOK" ? post.url : undefined,
                platformVideoId: platformVideoId, // Salvar shortcode extraído da URL
                username: account.username, // Salvar username da conta social
                status: "PENDING", // Posts começam pendentes de validação
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0,
              },
            });
          }),
        );

        const validPosts = createdPosts.filter((p) => p !== null);

        return {
          success: true,
          postsCreated: validPosts.length,
          posts: validPosts,
        };
      } catch (error) {
        console.error("Erro ao submeter posts:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao submeter posts",
        });
      }
    }),

  // Dados de melhores performances (para cards de conquistas)
  getBestPerformances: privateProcedure.query(async ({ ctx }) => {
    try {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        return {
          bestPosition: null,
          bestVideo: null,
          bestEngagementRate: null,
        };
      }

      // Buscar melhor posição em ranking mensal
      const bestRanking = await ctx.db.monthlyRankingEntry.findFirst({
        where: {
          clipperProfileId: clipperProfile.id,
        },
        orderBy: {
          position: "asc",
        },
        select: {
          position: true,
          monthlyRanking: {
            select: {
              campaign: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Buscar vídeo com mais views
      const bestVideo = await ctx.db.clipPost.findFirst({
        where: {
          application: {
            clipperProfileId: clipperProfile.id,
          },
          status: "ELIGIBLE",
        },
        orderBy: {
          views: "desc",
        },
        select: {
          views: true,
          submittedUrl: true,
        },
      });

      // Buscar melhor taxa de engajamento
      const postsWithMetrics = await ctx.db.clipPost.findMany({
        where: {
          application: {
            clipperProfileId: clipperProfile.id,
          },
          status: "ELIGIBLE",
          views: {
            gt: 0,
          },
        },
        select: {
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
        },
      });

      let bestEngagementRate = 0;
      postsWithMetrics.forEach((post) => {
        const views = Number(post.views);
        if (views > 0) {
          const rate = calculateEngagementRate(
            views,
            post.likes,
            post.comments,
            post.shares,
            post.saves ?? 0,
          );
          if (rate > bestEngagementRate) {
            bestEngagementRate = rate;
          }
        }
      });

      return {
        bestPosition: bestRanking
          ? {
              position: bestRanking.position,
              campaignName: bestRanking.monthlyRanking.campaign.name,
            }
          : null,
        bestVideo: bestVideo
          ? {
              views: Number(bestVideo.views),
              url: bestVideo.submittedUrl,
            }
          : null,
        bestEngagementRate: bestEngagementRate > 0 ? bestEngagementRate : null,
      };
    } catch (error) {
      console.error("Erro ao buscar melhores performances:", error);
      return {
        bestPosition: null,
        bestVideo: null,
        bestEngagementRate: null,
      };
    }
  }),

  // Buscar competição com menos clipadores (para destaque no home)
  getNextAvailableCompetition: privateProcedure.query(async ({ ctx }) => {
    try {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        return null;
      }

      const now = new Date();

      // Buscar apenas competições em andamento (já começaram e ainda não terminaram)
      // Excluir competições privadas - clipadores não podem se inscrever nelas
      const upcomingCampaigns = await ctx.db.campaign.findMany({
        where: {
          status: "ACTIVE", // Apenas competições ativas
          isPrivate: false, // Excluir competições privadas
          publishedAt: {
            not: null,
          },
          startDate: {
            lte: now, // Já começou
          },
          endDate: {
            gte: now, // Ainda não terminou
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          startDate: true,
          endDate: true,
          platforms: true,
          coverImageUrl: true,
          prizeInfo: true,
          requiredHashtags: true,
          status: true,
          isProOnly: true,
        },
      });

      // Batch: buscar todas as applications do clipper nesses campaigns de uma vez
      const campaignIds = upcomingCampaigns.map((c) => c.id);

      const [existingApplications, approvedCounts] = await Promise.all([
        ctx.db.clipperApplication.findMany({
          where: {
            campaignId: { in: campaignIds },
            clipperProfileId: clipperProfile.id,
          },
          select: { campaignId: true },
        }),
        ctx.db.clipperApplication.groupBy({
          by: ["campaignId"],
          where: {
            campaignId: { in: campaignIds },
            status: "APPROVED",
          },
          _count: { id: true },
        }),
      ]);

      const enrolledCampaignIds = new Set(
        existingApplications.map((a) => a.campaignId),
      );
      const countByCampaign = new Map(
        approvedCounts.map((r) => [r.campaignId, r._count.id]),
      );

      const availableCampaigns: Array<{
        campaign: (typeof upcomingCampaigns)[0];
        totalApplications: number;
      }> = upcomingCampaigns
        .filter((c) => !enrolledCampaignIds.has(c.id))
        .map((c) => ({
          campaign: c,
          totalApplications: countByCampaign.get(c.id) ?? 0,
        }));

      // Se não há competições disponíveis
      if (availableCampaigns.length === 0) {
        return null;
      }

      // Ordenar por número de participantes (menor primeiro)
      availableCampaigns.sort(
        (a, b) => a.totalApplications - b.totalApplications,
      );

      // Pegar a competição com menos clipadores
      const selected = availableCampaigns[0]!;
      const campaign = selected.campaign;

      const daysUntilStart = Math.ceil(
        (campaign.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const totalPrize =
        campaign.prizeInfo &&
        typeof campaign.prizeInfo === "object" &&
        "total" in campaign.prizeInfo
          ? typeof campaign.prizeInfo.total === "object"
            ? "R$ 0"
            : String(campaign.prizeInfo.total)
          : "R$ 0";

      return {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        description: campaign.description || "",
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        platforms: campaign.platforms,
        coverImageUrl: campaign.coverImageUrl,
        prize: totalPrize,
        requiredHashtags: campaign.requiredHashtags,
        totalApplications: selected.totalApplications,
        daysUntilStart,
        isProOnly: campaign.isProOnly,
      };
    } catch (error) {
      console.error("Erro ao buscar próxima competição disponível:", error);
      return null;
    }
  }),

  // Buscar minhas aplicações (para verificar status de inscrição)
  getMyApplications: privateProcedure.query(async ({ ctx }) => {
    try {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        return [];
      }

      const applications = await ctx.db.clipperApplication.findMany({
        where: {
          clipperProfileId: clipperProfile.id,
        },
        select: {
          id: true,
          campaignId: true,
          status: true,
          createdAt: true,
          approvedAt: true,
        },
      });

      return applications;
    } catch (error) {
      console.error("Erro ao buscar minhas aplicações:", error);
      return [];
    }
  }),

  // ============================================================================
  // RANKING DE CLIPPERS - Dados para página de ranking geral
  // ============================================================================

  // Ranking geral de clippers (views totais, ganhos, etc.)
  // Somente ADMIN: ranking interno com e-mail, saldo e total ganho de todos.
  getRankingData: adminProcedure.query(async ({ ctx }) => {
    try {
      // 1. Top Clippers por Views Totais (todas as competições)
      const topByTotalViews = await ctx.db.clipperApplication.findMany({
        where: {
          status: "APPROVED",
        },
        include: {
          clipperProfile: {
            include: {
              user: {
                select: {
                  imageUrl: true,
                  email: true,
                },
              },
              wallet: {
                select: {
                  totalEarned: true,
                  balance: true,
                },
              },
            },
          },
          clipPosts: {
            where: {
              status: "ELIGIBLE", // Apenas posts elegíveis (mesma regra do ranking mensal)
            },
            select: {
              views: true,
              likes: true,
              comments: true,
              shares: true,
              saves: true,
              platform: true,
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      // Agrupar por clipper e somar métricas (apenas posts ELIGIBLE)
      const clipperMetricsMap = new Map<
        string,
        {
          clipperProfileId: string;
          fullName: string;
          artisticName: string | null;
          imageUrl: string | null;
          email: string;
          totalViews: number;
          totalLikes: number;
          totalComments: number;
          totalShares: number;
          totalSaves: number;
          totalPosts: number;
          totalEarned: number;
          balance: number;
          competitionsCount: number;
          platformBreakdown: Record<string, { views: number; posts: number }>;
        }
      >();

      topByTotalViews.forEach((app) => {
        const clipperId = app.clipperProfileId;
        const existing = clipperMetricsMap.get(clipperId);

        // Calcular métricas dos posts desta aplicação
        let appViews = 0;
        let appLikes = 0;
        let appComments = 0;
        let appShares = 0;
        let appSaves = 0;
        const platformBreakdown: Record<
          string,
          { views: number; posts: number }
        > = {};

        app.clipPosts.forEach((post) => {
          const views = Number(post.views);
          appViews += views;
          appLikes += post.likes;
          appComments += post.comments;
          appShares += post.shares;
          appSaves += post.saves ?? 0;

          if (!platformBreakdown[post.platform]) {
            platformBreakdown[post.platform] = { views: 0, posts: 0 };
          }
          const platformData = platformBreakdown[post.platform]!;
          platformData.views += views;
          platformData.posts += 1;
        });

        if (existing) {
          existing.totalViews += appViews;
          existing.totalLikes += appLikes;
          existing.totalComments += appComments;
          existing.totalShares += appShares;
          existing.totalSaves += appSaves;
          existing.totalPosts += app.clipPosts.length;
          existing.competitionsCount += 1;

          // Merge platform breakdown
          Object.entries(platformBreakdown).forEach(([platform, data]) => {
            if (!existing.platformBreakdown[platform]) {
              existing.platformBreakdown[platform] = { views: 0, posts: 0 };
            }
            existing.platformBreakdown[platform].views += data.views;
            existing.platformBreakdown[platform].posts += data.posts;
          });
        } else {
          clipperMetricsMap.set(clipperId, {
            clipperProfileId: clipperId,
            fullName: app.clipperProfile.fullName,
            artisticName: app.clipperProfile.artisticName,
            imageUrl: app.clipperProfile.user?.imageUrl || null,
            email: app.clipperProfile.user?.email || "",
            totalViews: appViews,
            totalLikes: appLikes,
            totalComments: appComments,
            totalShares: appShares,
            totalSaves: appSaves,
            totalPosts: app.clipPosts.length,
            totalEarned: app.clipperProfile.wallet?.totalEarned || 0,
            balance: app.clipperProfile.wallet?.balance || 0,
            competitionsCount: 1,
            platformBreakdown,
          });
        }
      });

      // Converter para array e ordenar por views
      const topClippersByViews = Array.from(clipperMetricsMap.values())
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, 100)
        .map((c, index) => ({
          ...c,
          rank: index + 1,
          engagementRate: calculateEngagementRate(
            c.totalViews,
            c.totalLikes,
            c.totalComments,
            c.totalShares,
            c.totalSaves,
          ),
        }));

      // 2. Top Clippers por Ganhos
      const topClippersByEarnings = Array.from(clipperMetricsMap.values())
        .sort((a, b) => b.totalEarned - a.totalEarned)
        .slice(0, 50)
        .map((c, index) => ({
          ...c,
          rank: index + 1,
        }));

      // 3. Top por Plataforma
      const platformRankings: Record<
        string,
        Array<{
          rank: number;
          clipperProfileId: string;
          fullName: string;
          artisticName: string | null;
          imageUrl: string | null;
          views: number;
          posts: number;
        }>
      > = {};

      type PlatformRankingItem = {
        rank: number;
        clipperProfileId: string;
        fullName: string;
        artisticName: string | null;
        imageUrl: string | null;
        views: number;
        posts: number;
      };

      const platforms = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"];

      platforms.forEach((platform) => {
        const clippersForPlatform = Array.from(clipperMetricsMap.values())
          .filter((c) => c.platformBreakdown[platform])
          .map((c) => ({
            clipperProfileId: c.clipperProfileId,
            fullName: c.fullName,
            artisticName: c.artisticName,
            imageUrl: c.imageUrl,
            views: c.platformBreakdown[platform]?.views || 0,
            posts: c.platformBreakdown[platform]?.posts || 0,
          }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 15)
          .map((c, index) => ({
            ...c,
            rank: index + 1,
          }));

        platformRankings[platform] = clippersForPlatform;
      });

      // 4. Ranking por TODAS as Competições (não só ativas)
      const allCompetitions = await ctx.db.campaign.findMany({
        where: {
          status: {
            in: ["ACTIVE", "COMPLETED", "PAUSED", "SCHEDULED"],
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          coverImageUrl: true,
          startDate: true,
          endDate: true,
        },
        orderBy: [
          { status: "asc" }, // ACTIVE primeiro
          { endDate: "desc" },
        ],
      });

      const competitionRankings = await Promise.all(
        allCompetitions.map(async (campaign) => {
          const applications = await ctx.db.clipperApplication.findMany({
            where: {
              campaignId: campaign.id,
              status: "APPROVED",
            },
            include: {
              clipperProfile: {
                include: {
                  user: {
                    select: {
                      imageUrl: true,
                    },
                  },
                },
              },
              clipPosts: {
                where: {
                  status: "ELIGIBLE", // Apenas posts elegíveis (mesma regra do ranking mensal)
                },
                select: {
                  views: true,
                },
              },
            },
          });

          const ranking = applications
            .map((app) => ({
              clipperProfileId: app.clipperProfileId,
              fullName: app.clipperProfile.fullName,
              artisticName: app.clipperProfile.artisticName,
              imageUrl: app.clipperProfile.user?.imageUrl || null,
              totalViews: app.clipPosts.reduce(
                (sum, p) => sum + Number(p.views),
                0,
              ),
              postsCount: app.clipPosts.length,
            }))
            .sort((a, b) => b.totalViews - a.totalViews)
            .slice(0, 10)
            .map((c, index) => ({
              ...c,
              rank: index + 1,
            }));

          return {
            campaign: {
              id: campaign.id,
              name: campaign.name,
              slug: campaign.slug,
              status: campaign.status,
              coverImageUrl: campaign.coverImageUrl,
              startDate: campaign.startDate.toISOString(),
              endDate: campaign.endDate.toISOString(),
            },
            ranking,
          };
        }),
      );

      // 4.1 Campeões - Clipadores que foram Top 1 em competições finalizadas
      const completedCompetitions = allCompetitions.filter(
        (c) => c.status === "COMPLETED",
      );

      const champions: Array<{
        clipperProfileId: string;
        fullName: string;
        artisticName: string | null;
        imageUrl: string | null;
        competitionName: string;
        competitionSlug: string;
        competitionCoverUrl: string | null;
        totalViews: number;
        postsCount: number;
        endDate: string;
      }> = [];

      // Para cada competição finalizada, encontrar o campeão (top 1)
      for (const comp of competitionRankings) {
        if (completedCompetitions.some((c) => c.id === comp.campaign.id)) {
          const winner = comp.ranking.find((r) => r.rank === 1);
          if (winner) {
            champions.push({
              clipperProfileId: winner.clipperProfileId,
              fullName: winner.fullName,
              artisticName: winner.artisticName,
              imageUrl: winner.imageUrl,
              competitionName: comp.campaign.name,
              competitionSlug: comp.campaign.slug,
              competitionCoverUrl: comp.campaign.coverImageUrl,
              totalViews: winner.totalViews,
              postsCount: winner.postsCount,
              endDate: comp.campaign.endDate,
            });
          }
        }
      }

      // Ordenar campeões por data mais recente
      champions.sort(
        (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
      );

      // Contar quantas vezes cada clipador foi campeão
      const championCounts = new Map<string, number>();
      champions.forEach((c) => {
        const count = championCounts.get(c.clipperProfileId) || 0;
        championCounts.set(c.clipperProfileId, count + 1);
      });

      // Adicionar contagem de títulos aos campeões
      const championsWithTitles = champions.map((c) => ({
        ...c,
        titlesCount: championCounts.get(c.clipperProfileId) || 1,
      }));

      // Top campeões (quem mais venceu competições)
      const topChampions = Array.from(championCounts.entries())
        .map(([clipperProfileId, count]) => {
          const champData = champions.find(
            (c) => c.clipperProfileId === clipperProfileId,
          );
          return {
            clipperProfileId,
            fullName: champData?.fullName || "",
            artisticName: champData?.artisticName || null,
            imageUrl: champData?.imageUrl || null,
            titlesCount: count,
            competitions: champions
              .filter((c) => c.clipperProfileId === clipperProfileId)
              .map((c) => ({
                name: c.competitionName,
                slug: c.competitionSlug,
                coverUrl: c.competitionCoverUrl,
                views: c.totalViews,
              })),
          };
        })
        .sort((a, b) => b.titlesCount - a.titlesCount);

      // 5. Estatísticas gerais
      const totalClippers = clipperMetricsMap.size;
      const totalViewsAllTime = Array.from(clipperMetricsMap.values()).reduce(
        (sum, c) => sum + c.totalViews,
        0,
      );
      const totalEarningsAllTime = Array.from(
        clipperMetricsMap.values(),
      ).reduce((sum, c) => sum + c.totalEarned, 0);
      const totalPostsAllTime = Array.from(clipperMetricsMap.values()).reduce(
        (sum, c) => sum + c.totalPosts,
        0,
      );

      // 6. Distribuição por plataforma (para gráfico)
      const platformDistribution = platforms.map((platform) => {
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalPosts = 0;
        let clippersCount = 0;

        Array.from(clipperMetricsMap.values()).forEach((c) => {
          const platformData = c.platformBreakdown[platform];
          if (platformData) {
            totalViews += platformData.views;
            totalPosts += platformData.posts;
            clippersCount++;
          }
        });

        // Calcular totais de engajamento a partir do platformRankings
        const platformRanking = platformRankings[platform] || [];

        // Buscar métricas de engajamento dos clippers na plataforma
        Array.from(clipperMetricsMap.values()).forEach((c) => {
          if (c.platformBreakdown[platform]) {
            // Proporção de views desta plataforma no total
            const platformViewsRatio =
              c.totalViews > 0
                ? c.platformBreakdown[platform].views / c.totalViews
                : 0;
            // Estimar engajamento proporcional
            totalLikes += Math.round(c.totalLikes * platformViewsRatio);
            totalComments += Math.round(c.totalComments * platformViewsRatio);
            totalShares += Math.round(c.totalShares * platformViewsRatio);
          }
        });

        // Calcular taxa de engajamento
        const engagementRate = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
        );

        // Média de views por post
        const avgViewsPerPost = totalPosts > 0 ? totalViews / totalPosts : 0;

        return {
          platform,
          totalViews,
          totalPosts,
          totalLikes,
          totalComments,
          totalShares,
          clippersCount,
          engagementRate,
          avgViewsPerPost,
        };
      });

      // Contar competições ativas
      const activeCompetitionsCount = allCompetitions.filter(
        (c) => c.status === "ACTIVE",
      ).length;

      return {
        topClippersByViews,
        topClippersByEarnings,
        platformRankings,
        competitionRankings,
        champions: championsWithTitles,
        topChampions,
        platformDistribution,
        stats: {
          totalClippers,
          totalViewsAllTime,
          totalEarningsAllTime,
          totalPostsAllTime,
          activeCompetitionsCount,
          completedCompetitionsCount: completedCompetitions.length,
          totalCompetitionsCount: allCompetitions.length,
        },
      };
    } catch (error) {
      console.error("Erro ao buscar dados de ranking:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao buscar dados de ranking",
      });
    }
  }),

  // Marcar interesse em mais aulas
  markClassesInterest: privateProcedure.mutation(async ({ ctx }) => {
    try {
      // Buscar perfil do clipper
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Perfil de clipper não encontrado",
        });
      }

      // Atualizar campo classesInterestedIn
      await ctx.db.clipperProfile.update({
        where: { id: clipperProfile.id },
        data: {
          classesInterestedIn: true,
        },
      });

      return {
        success: true,
        message: "Interesse registrado com sucesso!",
      };
    } catch (error: any) {
      console.error("Erro ao marcar interesse em aulas:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao registrar interesse",
      });
    }
  }),

  // Adicionar contas à aplicação de uma competição
  addAccountsToApplication: privateProcedure
    .input(
      z.object({
        applicationId: z.string(),
        accountIds: z.array(z.string()).min(1, "Selecione ao menos uma conta"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar perfil do clipper
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        // Buscar aplicação
        const application = await ctx.db.clipperApplication.findUnique({
          where: { id: input.applicationId },
          select: {
            id: true,
            clipperProfileId: true,
          },
        });

        if (!application) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Aplicação não encontrada",
          });
        }

        // Verificar se a aplicação pertence ao clipper
        if (application.clipperProfileId !== clipperProfile.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não tem permissão para modificar esta aplicação",
          });
        }

        // Verificar se todas as contas pertencem ao clipper
        const socialAccounts = await ctx.db.socialAccount.findMany({
          where: {
            id: {
              in: input.accountIds,
            },
            clipperProfileId: clipperProfile.id,
          },
        });

        if (socialAccounts.length !== input.accountIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Uma ou mais contas não foram encontradas ou não pertencem a você",
          });
        }

        // Adicionar as contas à aplicação
        await Promise.all(
          socialAccounts.map((account) =>
            ctx.db.applicationSocialAccount.create({
              data: {
                applicationId: application.id,
                accountId: account.id,
              },
            }),
          ),
        );

        const youtubeSyncResults = [];
        for (const account of socialAccounts.filter(
          (acc) => acc.platform === "YOUTUBE",
        )) {
          try {
            const result = await leagueFetch(
              `/api/v1/youtube-sync/account/${account.id}`,
              {
                method: "POST",
                body: JSON.stringify({
                  lookbackDays: env.YOUTUBE_LINK_SYNC_LOOKBACK_DAYS,
                }),
              },
            );

            youtubeSyncResults.push({
              accountId: account.id,
              success: true,
              result,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Erro desconhecido";
            console.warn(
              `Falha ao sincronizar YouTube após vincular conta ${account.id}: ${message}`,
            );
            youtubeSyncResults.push({
              accountId: account.id,
              success: false,
              error: message,
            });
          }
        }

        const instagramSyncResults = [];
        for (const account of socialAccounts.filter(
          (acc) => acc.platform === "INSTAGRAM",
        )) {
          try {
            const result = await leagueFetch(
              `/api/v1/instagram-sync/full/${account.id}`,
              {
                method: "POST",
              },
            );

            instagramSyncResults.push({
              accountId: account.id,
              success: true,
              result,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Erro desconhecido";
            console.warn(
              `Falha ao sincronizar Instagram após vincular conta ${account.id}: ${message}`,
            );
            instagramSyncResults.push({
              accountId: account.id,
              success: false,
              error: message,
            });
          }
        }

        const tiktokSyncResults = [];
        for (const account of socialAccounts.filter(
          (acc) => acc.platform === "TIKTOK",
        )) {
          try {
            const result = await leagueFetch(
              `/api/v1/tiktok-sync/account/${account.id}`,
              {
                method: "POST",
              },
            );

            tiktokSyncResults.push({
              accountId: account.id,
              success: true,
              result,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Erro desconhecido";
            console.warn(
              `Falha ao sincronizar TikTok após vincular conta ${account.id}: ${message}`,
            );
            tiktokSyncResults.push({
              accountId: account.id,
              success: false,
              error: message,
            });
          }
        }

        console.log(
          `✅ ${socialAccounts.length} conta(s) adicionada(s) à aplicação ${application.id}`,
        );

        return {
          success: true,
          message: `${socialAccounts.length} conta(s) adicionada(s) com sucesso!`,
          youtubeSyncResults,
          instagramSyncResults,
          tiktokSyncResults,
        };
      } catch (error: any) {
        console.error("Erro ao adicionar contas à aplicação:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao adicionar contas",
        });
      }
    }),

  getTopClippersRanking: privateProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const posts = await ctx.db.clipPost.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        platform: true,
        application: {
          select: { clipperProfileId: true },
        },
      },
    });

    const clipperMap = new Map<
      string,
      {
        views: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        posts: number;
      }
    >();
    for (const post of posts) {
      const cpId = post.application.clipperProfileId;
      const existing = clipperMap.get(cpId) || {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        posts: 0,
      };
      existing.views += Number(post.views || 0);
      existing.likes += post.likes || 0;
      existing.comments += post.comments || 0;
      existing.shares += post.shares || 0;
      existing.saves += post.saves || 0;
      existing.posts += 1;
      clipperMap.set(cpId, existing);
    }

    const sorted = Array.from(clipperMap.entries())
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10);

    const topClippers = await Promise.all(
      sorted.map(async ([profileId, stats], index) => {
        const profile = await ctx.db.clipperProfile.findUnique({
          where: { id: profileId },
          include: {
            user: { select: { name: true, imageUrl: true } },
            clan: { select: { tag: true, emoji: true, emojiColor: true } },
            socialAccounts: { where: { isPrimary: true }, take: 1 },
          },
        });

        if (!profile) return null;

        const engagementRate = calculateEngagementRate(
          stats.views,
          stats.likes,
          stats.comments,
          stats.shares,
          stats.saves,
        );

        const username =
          profile.socialAccounts[0]?.username ||
          profile.instagramUsernames[0] ||
          "@clipper";

        return {
          position: index + 1,
          profileId,
          name: profile.user?.name || profile.fullName,
          artisticName: profile.artisticName || username,
          username,
          imageUrl: profile.user?.imageUrl || null,
          views: stats.views,
          posts: stats.posts,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares,
          engagementRate,
          clanTag: profile.clan?.tag || null,
          clanEmoji: profile.clan?.emoji || null,
          clanEmojiColor: profile.clan?.emojiColor || null,
        };
      }),
    );

    const currentMonth = now.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    return {
      clippers: topClippers.filter(Boolean),
      totalClippers: clipperMap.size,
      totalViews: Array.from(clipperMap.values()).reduce(
        (sum, s) => sum + s.views,
        0,
      ),
      totalPosts: posts.length,
      currentMonth,
    };
  }),
});
