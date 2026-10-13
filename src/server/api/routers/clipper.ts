import { z } from "zod";
import { createTRPCRouter, privateProcedure, adminProcedure, privateProcedureWithUser } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import {
  Prisma,
  type InstagramSyncStatus,
  type TikTokSyncStatus,
  type YouTubeSyncStatus,
} from "@prisma/client";
import { cachedQuery } from "@/server/memory-cache";
import { getCachedActiveCampaigns } from "@/server/competition-active-campaigns";
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

// ============================================================================
// LISTA DE CLIPADORES (ADMIN) - filtrada, ordenada e paginada no banco
// ============================================================================

const clipperListFiltersSchema = z.object({
  status: z
    .enum(["VERIFIED", "PENDING", "UNVERIFIED", "REJECTED", "BANNED", "ALL"])
    .optional()
    .default("ALL"),
  search: z.string().optional(),
  subscription: z
    .enum(["ACTIVE", "TRIAL", "CANCELLED", "EXPIRED", "NONE", "ALL"])
    .optional()
    .default("ALL"),
});

type ClipperListFilters = z.infer<typeof clipperListFiltersSchema>;

/**
 * WHERE da lista de clipadores (página e "Copiar Aprovados"), sobre
 * `"ClipperProfile" cp JOIN "User" u`.
 *
 * - A busca casa nome, nome artístico, e-mail ou @username de uma conta
 *   social com `ILIKE '%termo%'`, o mesmo SQL do `contains` +
 *   `mode: "insensitive"` usado antes (que também não escapa % e _).
 * - O status agora vale também para quem casou só pelo @username: antes
 *   esses perfis entravam na lista com qualquer status.
 * - A assinatura era filtrada no cliente; o banco aplica o mesmo filtro.
 */
function clipperListWhereSql(filters: ClipperListFilters) {
  const conditions: Prisma.Sql[] = [];

  if (filters.status !== "ALL") {
    conditions.push(
      Prisma.sql`cp."verificationStatus" = ${filters.status}::"ClipperVerificationStatus"`,
    );
  }

  if (filters.subscription !== "ALL") {
    conditions.push(
      Prisma.sql`u."subscriptionStatus" = ${filters.subscription}::"SubscriptionStatus"`,
    );
  }

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    // O @username era buscado com o termo em minúsculas.
    const usernamePattern = `%${search.toLowerCase()}%`;
    conditions.push(Prisma.sql`(
      cp."fullName" ILIKE ${pattern}
      OR cp."artisticName" ILIKE ${pattern}
      OR u."email" ILIKE ${pattern}
      OR EXISTS (
        SELECT 1
        FROM "SocialAccount" sa
        WHERE sa."clipperProfileId" = cp."id"
          AND sa."username" ILIKE ${usernamePattern}
      )
    )`);
  }

  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
}

/**
 * Ordenações das colunas da tabela, iguais ao sort que o TanStack fazia no
 * cliente: nome sem diferenciar maiúsculas e comparado por código (como o
 * JS), ganhos com carteira ausente = 0, ER/score com nulos abaixo de
 * qualquer número. O desempate é a ordem base (cadastro mais recente).
 */
const CLIPPER_LIST_SORT_SQL = {
  fullName: {
    asc: Prisma.sql`lower(cp."fullName") COLLATE "C" ASC`,
    desc: Prisma.sql`lower(cp."fullName") COLLATE "C" DESC`,
  },
  totalEarned: {
    asc: Prisma.sql`COALESCE(w."totalEarned", 0) ASC`,
    desc: Prisma.sql`COALESCE(w."totalEarned", 0) DESC`,
  },
  avgEngagementRate: {
    asc: Prisma.sql`cp."avgEngagementRate" ASC NULLS FIRST`,
    desc: Prisma.sql`cp."avgEngagementRate" DESC NULLS LAST`,
  },
  autoScore: {
    asc: Prisma.sql`cp."autoScore" ASC NULLS FIRST`,
    desc: Prisma.sql`cp."autoScore" DESC NULLS LAST`,
  },
};

// ============================================================================
// RANKING GERAL (ADMIN) - somado no banco, uma procedure por aba
// ============================================================================

const RANKING_PLATFORMS = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "KWAI",
  "FACEBOOK",
];

// Ranking interno do painel: alguns minutos de defasagem são aceitáveis.
const RANKING_CACHE_TTL_MS = 3 * 60 * 1000;

type RankingClipperMetrics = {
  clipperProfileId: string;
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
};

type RankingProfile = {
  fullName: string;
  artisticName: string | null;
  imageUrl: string | null;
  email: string;
};

const EMPTY_RANKING_PROFILE: RankingProfile = {
  fullName: "",
  artisticName: null,
  imageUrl: null,
  email: "",
};

/**
 * Métricas de todo clipador com inscrição APPROVED (em qualquer competição),
 * somando só os posts ELIGIBLE dessas inscrições — a mesma regra de antes,
 * quando todas as inscrições eram carregadas com todos os posts.
 *
 * O banco devolve uma linha por clipador × plataforma; daqui em diante é
 * soma de inteiros, então os totais batem exatamente com a soma post a post.
 * A ordem por id é o desempate (estável) dos rankings derivados.
 */
function loadRankingClipperMetrics(db: PrismaClient) {
  return cachedQuery(
    "clipper-ranking:metrics",
    RANKING_CACHE_TTL_MS,
    async () => {
      const [clippers, platformRows] = await Promise.all([
        db.$queryRaw<
          Array<{
            clipperProfileId: string;
            competitionsCount: number;
            totalEarned: number | null;
            balance: number | null;
          }>
        >`
        SELECT
          ap."clipperProfileId",
          ap."competitionsCount",
          w."totalEarned",
          w."balance"
        FROM (
          SELECT "clipperProfileId", COUNT(*)::int AS "competitionsCount"
          FROM "ClipperApplication"
          WHERE "status" = 'APPROVED'
          GROUP BY "clipperProfileId"
        ) ap
        LEFT JOIN "Wallet" w ON w."clipperProfileId" = ap."clipperProfileId"
        ORDER BY ap."clipperProfileId"
      `,
        db.$queryRaw<
          Array<{
            clipperProfileId: string;
            platform: string;
            views: bigint;
            likes: bigint;
            comments: bigint;
            shares: bigint;
            saves: bigint;
            posts: number;
          }>
        >`
        SELECT
          a."clipperProfileId",
          p."platform"::text AS "platform",
          SUM(p."views")::bigint AS "views",
          SUM(p."likes")::bigint AS "likes",
          SUM(p."comments")::bigint AS "comments",
          SUM(p."shares")::bigint AS "shares",
          COALESCE(SUM(p."saves"), 0)::bigint AS "saves",
          COUNT(*)::int AS "posts"
        FROM "ClipPost" p
        JOIN "ClipperApplication" a ON a."id" = p."applicationId"
        WHERE a."status" = 'APPROVED' AND p."status" = 'ELIGIBLE'
        GROUP BY a."clipperProfileId", p."platform"
        ORDER BY a."clipperProfileId", p."platform"
      `,
      ]);

      const metrics = new Map<string, RankingClipperMetrics>();
      for (const clipper of clippers) {
        metrics.set(clipper.clipperProfileId, {
          clipperProfileId: clipper.clipperProfileId,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalSaves: 0,
          totalPosts: 0,
          totalEarned: clipper.totalEarned || 0,
          balance: clipper.balance || 0,
          competitionsCount: clipper.competitionsCount,
          platformBreakdown: {},
        });
      }

      for (const row of platformRows) {
        const clipper = metrics.get(row.clipperProfileId);
        if (!clipper) continue;
        const views = Number(row.views);
        clipper.totalViews += views;
        clipper.totalLikes += Number(row.likes);
        clipper.totalComments += Number(row.comments);
        clipper.totalShares += Number(row.shares);
        clipper.totalSaves += Number(row.saves);
        clipper.totalPosts += row.posts;
        clipper.platformBreakdown[row.platform] = { views, posts: row.posts };
      }

      return Array.from(metrics.values());
    },
  );
}

/** Nome, foto e e-mail só dos clipadores que aparecem na aba. */
async function loadRankingProfiles(db: PrismaClient, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  const profiles = new Map<string, RankingProfile>();
  if (uniqueIds.length === 0) return profiles;

  const rows = await db.clipperProfile.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      fullName: true,
      artisticName: true,
      user: { select: { imageUrl: true, email: true } },
    },
  });
  for (const row of rows) {
    profiles.set(row.id, {
      fullName: row.fullName,
      artisticName: row.artisticName,
      imageUrl: row.user.imageUrl || null,
      email: row.user.email || "",
    });
  }
  return profiles;
}

function rankingClipperEntry(
  clipper: RankingClipperMetrics,
  profiles: Map<string, RankingProfile>,
) {
  const profile =
    profiles.get(clipper.clipperProfileId) ?? EMPTY_RANKING_PROFILE;
  return {
    clipperProfileId: clipper.clipperProfileId,
    fullName: profile.fullName,
    artisticName: profile.artisticName,
    imageUrl: profile.imageUrl,
    email: profile.email,
    totalViews: clipper.totalViews,
    totalLikes: clipper.totalLikes,
    totalComments: clipper.totalComments,
    totalShares: clipper.totalShares,
    totalSaves: clipper.totalSaves,
    totalPosts: clipper.totalPosts,
    totalEarned: clipper.totalEarned,
    balance: clipper.balance,
    competitionsCount: clipper.competitionsCount,
    platformBreakdown: clipper.platformBreakdown,
  };
}

/** Aba "Geral": top 100 por views totais. */
function loadRankingByViews(db: PrismaClient) {
  return cachedQuery(
    "clipper-ranking:views",
    RANKING_CACHE_TTL_MS,
    async () => {
      const metrics = await loadRankingClipperMetrics(db);
      const top = [...metrics]
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, 100);
      const profiles = await loadRankingProfiles(
        db,
        top.map((c) => c.clipperProfileId),
      );
      return top.map((c, index) => ({
        ...rankingClipperEntry(c, profiles),
        rank: index + 1,
        engagementRate: calculateEngagementRate(
          c.totalViews,
          c.totalLikes,
          c.totalComments,
          c.totalShares,
          c.totalSaves,
        ),
      }));
    },
  );
}

/** Aba "Ganhos": top 50 por total ganho na carteira. */
function loadRankingByEarnings(db: PrismaClient) {
  return cachedQuery(
    "clipper-ranking:earnings",
    RANKING_CACHE_TTL_MS,
    async () => {
      const metrics = await loadRankingClipperMetrics(db);
      const top = [...metrics]
        .sort((a, b) => b.totalEarned - a.totalEarned)
        .slice(0, 50);
      const profiles = await loadRankingProfiles(
        db,
        top.map((c) => c.clipperProfileId),
      );
      return top.map((c, index) => ({
        ...rankingClipperEntry(c, profiles),
        rank: index + 1,
      }));
    },
  );
}

/** Aba "Plataformas": top 15 por plataforma + distribuição. */
function loadRankingByPlatform(db: PrismaClient) {
  return cachedQuery(
    "clipper-ranking:platforms",
    RANKING_CACHE_TTL_MS,
    async () => {
      const metrics = await loadRankingClipperMetrics(db);

      const topByPlatform = RANKING_PLATFORMS.map((platform) => ({
        platform,
        top: metrics
          .filter((c) => c.platformBreakdown[platform])
          .map((c) => ({
            clipperProfileId: c.clipperProfileId,
            views: c.platformBreakdown[platform]?.views || 0,
            posts: c.platformBreakdown[platform]?.posts || 0,
          }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 15),
      }));
      const profiles = await loadRankingProfiles(
        db,
        topByPlatform.flatMap(({ top }) => top.map((c) => c.clipperProfileId)),
      );

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
      for (const { platform, top } of topByPlatform) {
        platformRankings[platform] = top.map((c, index) => {
          const profile =
            profiles.get(c.clipperProfileId) ?? EMPTY_RANKING_PROFILE;
          return {
            clipperProfileId: c.clipperProfileId,
            fullName: profile.fullName,
            artisticName: profile.artisticName,
            imageUrl: profile.imageUrl,
            views: c.views,
            posts: c.posts,
            rank: index + 1,
          };
        });
      }

      // Distribuição por plataforma (para gráfico)
      const platformDistribution = RANKING_PLATFORMS.map((platform) => {
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalPosts = 0;
        let clippersCount = 0;

        for (const c of metrics) {
          const platformData = c.platformBreakdown[platform];
          if (!platformData) continue;
          totalViews += platformData.views;
          totalPosts += platformData.posts;
          clippersCount++;

          // Engajamento estimado pela proporção de views desta plataforma no
          // total do clipador (arredondado por clipador, como antes).
          const platformViewsRatio =
            c.totalViews > 0 ? platformData.views / c.totalViews : 0;
          totalLikes += Math.round(c.totalLikes * platformViewsRatio);
          totalComments += Math.round(c.totalComments * platformViewsRatio);
          totalShares += Math.round(c.totalShares * platformViewsRatio);
        }

        return {
          platform,
          totalViews,
          totalPosts,
          totalLikes,
          totalComments,
          totalShares,
          clippersCount,
          engagementRate: calculateEngagementRate(
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
          ),
          avgViewsPerPost: totalPosts > 0 ? totalViews / totalPosts : 0,
        };
      });

      return { platformRankings, platformDistribution };
    },
  );
}

/**
 * Aba "Competições": top 10 por views de cada competição (ACTIVE,
 * COMPLETED, PAUSED ou SCHEDULED). O banco soma os posts ELIGIBLE de cada
 * inscrição APPROVED e numera as posições; inscrições sem post contam 0.
 */
function loadRankingByCompetition(db: PrismaClient) {
  return cachedQuery(
    "clipper-ranking:competitions",
    RANKING_CACHE_TTL_MS,
    async () => {
      const allCompetitions = await db.campaign.findMany({
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
          { status: "asc" }, // ordem do enum: SCHEDULED, ACTIVE, PAUSED, COMPLETED
          { endDate: "desc" },
        ],
      });

      const rows =
        allCompetitions.length === 0
          ? []
          : await db.$queryRaw<
              Array<{
                campaignId: string;
                clipperProfileId: string;
                totalViews: bigint;
                postsCount: number;
                rank: number;
              }>
            >`
            SELECT r."campaignId", r."clipperProfileId", r."totalViews", r."postsCount", r."rank"
            FROM (
              SELECT
                t.*,
                (ROW_NUMBER() OVER (
                  PARTITION BY t."campaignId"
                  ORDER BY t."totalViews" DESC, t."clipperProfileId"
                ))::int AS "rank"
              FROM (
                SELECT
                  a."campaignId",
                  a."clipperProfileId",
                  COALESCE(SUM(p."views"), 0)::bigint AS "totalViews",
                  COUNT(p."id")::int AS "postsCount"
                FROM "ClipperApplication" a
                LEFT JOIN "ClipPost" p
                  ON p."applicationId" = a."id" AND p."status" = 'ELIGIBLE'
                WHERE a."status" = 'APPROVED'
                  AND a."campaignId" IN (${Prisma.join(allCompetitions.map((c) => c.id))})
                GROUP BY a."id"
              ) t
            ) r
            WHERE r."rank" <= 10
            ORDER BY r."campaignId", r."rank"
          `;

      const profiles = await loadRankingProfiles(
        db,
        rows.map((row) => row.clipperProfileId),
      );
      const rowsByCampaign = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = rowsByCampaign.get(row.campaignId) ?? [];
        list.push(row);
        rowsByCampaign.set(row.campaignId, list);
      }

      return allCompetitions.map((campaign) => ({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status,
          coverImageUrl: campaign.coverImageUrl,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
        },
        ranking: (rowsByCampaign.get(campaign.id) ?? []).map((row) => {
          const profile =
            profiles.get(row.clipperProfileId) ?? EMPTY_RANKING_PROFILE;
          return {
            clipperProfileId: row.clipperProfileId,
            fullName: profile.fullName,
            artisticName: profile.artisticName,
            imageUrl: profile.imageUrl,
            totalViews: Number(row.totalViews),
            postsCount: row.postsCount,
            rank: row.rank,
          };
        }),
      }));
    },
  );
}

/** Aba "Campeões": o 1º lugar de cada competição finalizada. */
function loadRankingChampions(db: PrismaClient) {
  return cachedQuery(
    "clipper-ranking:champions",
    RANKING_CACHE_TTL_MS,
    async () => {
      const competitionRankings = await loadRankingByCompetition(db);

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

      for (const comp of competitionRankings) {
        if (comp.campaign.status !== "COMPLETED") continue;
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

      return { champions: championsWithTitles, topChampions };
    },
  );
}

/** Números do topo da página (hero e KPIs). */
function loadRankingSummary(db: PrismaClient) {
  return cachedQuery(
    "clipper-ranking:summary",
    RANKING_CACHE_TTL_MS,
    async () => {
      const [metrics, competitionsByStatus] = await Promise.all([
        loadRankingClipperMetrics(db),
        db.campaign.groupBy({
          by: ["status"],
          where: {
            status: {
              in: ["ACTIVE", "COMPLETED", "PAUSED", "SCHEDULED"],
            },
          },
          _count: { _all: true },
        }),
      ]);
      const competitionsWithStatus = (status: string) =>
        competitionsByStatus.find((group) => group.status === status)?._count
          ._all ?? 0;

      return {
        totalClippers: metrics.length,
        totalViewsAllTime: metrics.reduce((sum, c) => sum + c.totalViews, 0),
        totalEarningsAllTime: metrics.reduce(
          (sum, c) => sum + c.totalEarned,
          0,
        ),
        totalPostsAllTime: metrics.reduce((sum, c) => sum + c.totalPosts, 0),
        activeCompetitionsCount: competitionsWithStatus("ACTIVE"),
        completedCompetitionsCount: competitionsWithStatus("COMPLETED"),
        totalCompetitionsCount: competitionsByStatus.reduce(
          (sum, group) => sum + group._count._all,
          0,
        ),
      };
    },
  );
}

async function withRankingError<T>(load: () => Promise<T>) {
  try {
    return await load();
  } catch (error) {
    console.error("Erro ao buscar dados de ranking:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Erro ao buscar dados de ranking",
    });
  }
}

export const clipperRouter = createTRPCRouter({
  canUseSocialIntegrations: privateProcedureWithUser.query(({ ctx }) => {
    return canUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });
  }),

  // Lista de clipadores do painel (somente ADMIN), paginada no banco.
  // Traz só as colunas que a tabela mostra; o perfil completo (cpf,
  // telefone, chave PIX) vem do getById quando o detalhe é aberto.
  getAll: adminProcedure
    .input(
      clipperListFiltersSchema.extend({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
        sortBy: z
          .enum(["fullName", "totalEarned", "avgEngagementRate", "autoScore"])
          .optional(),
        sortDir: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = clipperListWhereSql(input);
      // Base: cadastro mais recente primeiro; a coluna escolhida vem antes
      // (mesmo resultado do sort estável que era feito no cliente).
      const orderBy = input.sortBy
        ? Prisma.sql`${CLIPPER_LIST_SORT_SQL[input.sortBy][input.sortDir]}, cp."createdAt" DESC, cp."id" DESC`
        : Prisma.sql`cp."createdAt" DESC, cp."id" DESC`;
      const offset = (input.page - 1) * input.pageSize;

      const [pageRows, countRows] = await Promise.all([
        ctx.db.$queryRaw<Array<{ id: string }>>`
          SELECT cp."id"
          FROM "ClipperProfile" cp
          JOIN "User" u ON u."id" = cp."userId"
          LEFT JOIN "Wallet" w ON w."clipperProfileId" = cp."id"
          ${where}
          ORDER BY ${orderBy}
          LIMIT ${input.pageSize}
          OFFSET ${offset}
        `,
        ctx.db.$queryRaw<Array<{ total: number }>>`
          SELECT COUNT(*)::int AS "total"
          FROM "ClipperProfile" cp
          JOIN "User" u ON u."id" = cp."userId"
          ${where}
        `,
      ]);

      const ids = pageRows.map((row) => row.id);
      const profiles =
        ids.length === 0
          ? []
          : await ctx.db.clipperProfile.findMany({
              where: { id: { in: ids } },
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                city: true,
                state: true,
                verificationStatus: true,
                avgEngagementRate: true,
                autoScore: true,
                createdAt: true,
                user: {
                  select: {
                    email: true,
                    imageUrl: true,
                    subscriptionStatus: true,
                  },
                },
                socialAccounts: { select: { platform: true } },
                wallet: { select: { totalEarned: true } },
              },
            });

      // findMany não garante ordem: volta para a ordem da página.
      const profilesById = new Map(profiles.map((p) => [p.id, p]));
      const items = ids.flatMap((id) => {
        const profile = profilesById.get(id);
        return profile ? [profile] : [];
      });

      return { items, total: countRows[0]?.total ?? 0 };
    }),

  // "Copiar Aprovados" (somente ADMIN): nome, e-mail, CPF e chave PIX dos
  // VERIFIED que passam pelos filtros da lista, buscados só no clique.
  exportVerified: adminProcedure
    .input(clipperListFiltersSchema)
    .query(async ({ ctx, input }) => {
      // Filtrando outro status, a lista não tem nenhum VERIFIED.
      if (input.status !== "ALL" && input.status !== "VERIFIED") return [];

      const where = clipperListWhereSql({ ...input, status: "VERIFIED" });
      return ctx.db.$queryRaw<
        Array<{
          fullName: string;
          artisticName: string | null;
          email: string;
          cpf: string;
          pixKey: string;
        }>
      >`
        SELECT cp."fullName", cp."artisticName", u."email", cp."cpf", cp."pixKey"
        FROM "ClipperProfile" cp
        JOIN "User" u ON u."id" = cp."userId"
        ${where}
        ORDER BY cp."createdAt" DESC, cp."id" DESC
      `;
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
      ctx.db.clipPost.aggregate({
        where: { status: "ELIGIBLE" },
        _count: { id: true },
      }),
      ctx.db.clipPost.aggregate({
        where: { status: "ELIGIBLE" },
        _sum: { views: true },
      }),
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
      LEFT JOIN "ClipPost" p
        ON p."applicationId" = ca."id" AND p."status" = 'ELIGIBLE'
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
        // Chamada em toda página (chip de saldo no cabeçalho): sem logs por requisição.
        const wallet = await ctx.db.wallet.findUnique({
          where: { clipperProfileId: input.clipperProfileId },
        });

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
        // Filtra pela wallet do clipador direto na relação (sem wallet: 0 linhas)
        const where: any = {
          wallet: { clipperProfileId: input.clipperProfileId },
        };

        if (input.type && input.type !== "ALL") {
          where.type = input.type;
        }

        if (input.status && input.status !== "ALL") {
          where.status = input.status;
        }

        // Total e página em paralelo; só os campos exibidos (sem os JSON de
        // saque/metadata das até 500 linhas)
        const [total, transactions] = await Promise.all([
          ctx.db.transaction.count({ where }),
          ctx.db.transaction.findMany({
            where,
            orderBy: {
              createdAt: "desc",
            },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            select: {
              id: true,
              type: true,
              status: true,
              amount: true,
              balanceBefore: true,
              balanceAfter: true,
              description: true,
              rankingPosition: true,
              proofUrls: true,
              createdAt: true,
            },
          }),
        ]);

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
        // Todas as contagens/somas numa consulta (antes: wallet + 6 consultas);
        // sem wallet, tudo 0 e lastTransaction null, como antes.
        const [statsRows, lastTransaction] = await Promise.all([
          ctx.db.$queryRaw<
            Array<{
              totalTransactions: number;
              totalCredits: number;
              totalCreditsCount: number;
              totalWithdrawals: number;
              pendingWithdrawals: number;
              completedWithdrawals: number;
            }>
          >`
            SELECT
              COUNT(*)::int AS "totalTransactions",
              COALESCE(SUM(t."amount") FILTER (
                WHERE t."type" IN ('PRIZE_CREDIT', 'BONUS', 'ADJUSTMENT', 'REFUND')
                  AND t."status" = 'COMPLETED'
                  AND t."amount" > 0
              ), 0)::float8 AS "totalCredits",
              (COUNT(*) FILTER (
                WHERE t."type" IN ('PRIZE_CREDIT', 'BONUS', 'ADJUSTMENT', 'REFUND')
                  AND t."status" = 'COMPLETED'
                  AND t."amount" > 0
              ))::int AS "totalCreditsCount",
              (COUNT(*) FILTER (
                WHERE t."type" IN ('WITHDRAWAL_REQUEST', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_COMPLETED')
              ))::int AS "totalWithdrawals",
              (COUNT(*) FILTER (
                WHERE t."type" IN ('WITHDRAWAL_REQUEST', 'WITHDRAWAL_APPROVED')
                  AND t."status" IN ('PENDING', 'PROCESSING')
              ))::int AS "pendingWithdrawals",
              (COUNT(*) FILTER (
                WHERE t."type" = 'WITHDRAWAL_COMPLETED' AND t."status" = 'COMPLETED'
              ))::int AS "completedWithdrawals"
            FROM "Transaction" t
            INNER JOIN "Wallet" w ON w."id" = t."walletId"
            WHERE w."clipperProfileId" = ${input.clipperProfileId}
          `,
          ctx.db.transaction.findFirst({
            where: { wallet: { clipperProfileId: input.clipperProfileId } },
            orderBy: { createdAt: "desc" },
          }),
        ]);
        const stats = statsRows[0];
        const totalTransactions = stats?.totalTransactions ?? 0;
        const totalWithdrawals = stats?.totalWithdrawals ?? 0;
        const pendingWithdrawals = stats?.pendingWithdrawals ?? 0;
        const completedWithdrawals = stats?.completedWithdrawals ?? 0;

        return {
          totalTransactions,
          totalCredits: stats?.totalCredits || 0,
          totalCreditsCount: stats?.totalCreditsCount ?? 0,
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
      // Perfil do clipper do usuário atual (uma consulta por requisição)
      const clipperProfileId = await ctx.getClipperProfileId();
      const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;

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

      const [wallet, activeCompetitions, viewsAgg, applications] = await Promise.all([
        ctx.db.wallet.findUnique({
          where: { clipperProfileId: clipperProfile.id },
          select: { totalEarned: true },
        }),
        // Aplicações aprovadas (competições ativas)
        ctx.db.clipperApplication.count({
          where: {
            clipperProfileId: clipperProfile.id,
            status: "APPROVED",
            campaign: {
              status: {
                in: ["ACTIVE", "SCHEDULED"],
              },
            },
          },
        }),
        // Total de views dos posts elegíveis do clipper
        ctx.db.clipPost.aggregate({
          where: {
            application: {
              clipperProfileId: clipperProfile.id,
            },
            status: "ELIGIBLE",
          },
          _sum: { views: true },
        }),
        // Rankings mensais atuais (um por campanha)
        ctx.db.clipperApplication.findMany({
          where: {
            clipperProfileId: clipperProfile.id,
            status: "APPROVED",
          },
          select: {
            id: true,
          },
        }),
      ]);

      // Calcular total de views
      const totalViews = Number(viewsAgg._sum.views ?? 0);

      // Total ganho (da wallet)
      const totalEarned = wallet?.totalEarned || 0;

      // Entrada mais recente (lastUpdated) de cada inscrição, numa query só
      const rankingEntries =
        applications.length > 0
          ? await ctx.db.monthlyRankingEntry.findMany({
              where: {
                applicationId: { in: applications.map((app) => app.id) },
              },
              orderBy: {
                lastUpdated: "desc",
              },
              select: {
                applicationId: true,
                position: true,
                previousPosition: true,
                monthlyRanking: {
                  select: {
                    campaignId: true,
                  },
                },
              },
            })
          : [];
      const latestByApplication = new Map<
        string,
        (typeof rankingEntries)[number]
      >();
      for (const entry of rankingEntries) {
        if (!latestByApplication.has(entry.applicationId)) {
          latestByApplication.set(entry.applicationId, entry);
        }
      }
      const rankings = applications.map(
        (app) => latestByApplication.get(app.id) ?? null,
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
        activeCompetitions,
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

  // Nome/slug das competições ativas do clipper (menu lateral): mesmo filtro e
  // ordem de getMyCompetitions, sem as métricas.
  getMyCompetitionOptions: privateProcedure.query(async ({ ctx }) => {
    const applications = await ctx.db.clipperApplication.findMany({
      where: {
        clipperProfile: { userId: ctx.userId },
        status: "APPROVED",
        campaign: {
          status: {
            in: ["ACTIVE", "SCHEDULED"],
          },
        },
      },
      select: {
        campaign: { select: { id: true, name: true, slug: true } },
      },
    });
    return applications.map((app) => app.campaign);
  }),

  // Buscar competições ativas do clipper (para enviar posts)
  getMyCompetitions: privateProcedure.query(async ({ ctx }) => {
    try {
      // Perfil buscado uma vez por requisição (compartilhado no batch)
      const clipperProfileId = await ctx.getClipperProfileId();
      const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;

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
        select: {
          id: true,
          campaignId: true,
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
        },
      });

      if (applications.length === 0) return [];

      const applicationIds = applications.map((a) => a.id);
      const campaignIds = [...new Set(applications.map((a) => a.campaignId))];

      // Agregados em vez de carregar os posts e o distinct em memória
      const [rankings, participantCounts, eligibleTotals] = await Promise.all([
        ctx.db.monthlyRankingEntry.groupBy({
          by: ["applicationId"],
          where: { applicationId: { in: applicationIds } },
          _min: { position: true },
        }),
        ctx.db.clipperApplication.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: campaignIds }, status: "APPROVED" },
          _count: { id: true },
        }),
        ctx.db.clipPost.groupBy({
          by: ["applicationId"],
          where: { applicationId: { in: applicationIds }, status: "ELIGIBLE" },
          _count: { id: true },
          _sum: { views: true },
        }),
      ]);

      const rankingByApp = new Map(
        rankings.map((r) => [r.applicationId, r._min.position]),
      );
      const participantCountMap = new Map(
        participantCounts.map((r) => [r.campaignId, r._count.id]),
      );
      const eligibleByApp = new Map(
        eligibleTotals.map((row) => [row.applicationId, row]),
      );

      const now = new Date();

      const competitionsWithRankings = applications.map((app) => {
        const bestPosition = rankingByApp.get(app.id);
        const totalParticipants = participantCountMap.get(app.campaignId) ?? 0;
        const eligible = eligibleByApp.get(app.id);

        const myViews = Number(eligible?._sum.views ?? 0);

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
          myRanking: bestPosition || 0,
          totalParticipants,
          myPosts: eligible?._count.id ?? 0,
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

      // Só o último log de sincronização de cada conexão. O `syncLogs:
      // { take: 1 }` aninhado trazia todos os logs da conexão para a memória
      // (o Prisma aplica o take depois); aqui o banco devolve uma linha por
      // conexão (mesmo critério: createdAt mais recente).
      type SyncLogRow = {
        authId: string;
        id: string;
        videosProcessed: number;
        videosUpdated: number;
        videosFailed: number;
        errorMessage: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
      };
      const accounts = clipperProfile.socialAccounts;
      const youtubeAuthIds = accounts.flatMap((a) =>
        a.youtubeAuth ? [a.youtubeAuth.id] : [],
      );
      const instagramAuthIds = accounts.flatMap((a) =>
        a.instagramAuth ? [a.instagramAuth.id] : [],
      );
      const tiktokAuthIds = accounts.flatMap((a) =>
        a.tiktokAuth ? [a.tiktokAuth.id] : [],
      );

      const [youtubeLogRows, instagramLogRows, tiktokLogRows] =
        await Promise.all([
          youtubeAuthIds.length === 0
            ? []
            : ctx.db.$queryRaw<
                Array<SyncLogRow & { status: YouTubeSyncStatus }>
              >`
                SELECT
                  auth."id" AS "authId",
                  l."id",
                  l."status"::text AS "status",
                  l."videosProcessed",
                  l."videosUpdated",
                  l."videosFailed",
                  l."errorMessage",
                  l."startedAt",
                  l."completedAt",
                  l."createdAt"
                FROM "YouTubeAuth" auth
                CROSS JOIN LATERAL (
                  SELECT
                    log."id", log."status", log."videosProcessed",
                    log."videosUpdated", log."videosFailed",
                    log."errorMessage", log."startedAt",
                    log."completedAt", log."createdAt"
                  FROM "YouTubeSyncLog" log
                  WHERE log."youtubeAuthId" = auth."id"
                  ORDER BY log."createdAt" DESC, log."id" DESC
                  LIMIT 1
                ) l
                WHERE auth."id" IN (${Prisma.join(youtubeAuthIds)})
              `,
          instagramAuthIds.length === 0
            ? []
            : ctx.db.$queryRaw<
                Array<
                  SyncLogRow & {
                    status: InstagramSyncStatus;
                    commentsFetched: number;
                    commentsNew: number;
                  }
                >
              >`
                SELECT
                  auth."id" AS "authId",
                  l."id",
                  l."status"::text AS "status",
                  l."videosProcessed",
                  l."videosUpdated",
                  l."videosFailed",
                  l."commentsFetched",
                  l."commentsNew",
                  l."errorMessage",
                  l."startedAt",
                  l."completedAt",
                  l."createdAt"
                FROM "InstagramAuth" auth
                CROSS JOIN LATERAL (
                  SELECT
                    log."id", log."status", log."videosProcessed",
                    log."videosUpdated", log."videosFailed",
                    log."commentsFetched", log."commentsNew",
                    log."errorMessage", log."startedAt",
                    log."completedAt", log."createdAt"
                  FROM "InstagramSyncLog" log
                  WHERE log."instagramAuthId" = auth."id"
                  ORDER BY log."createdAt" DESC, log."id" DESC
                  LIMIT 1
                ) l
                WHERE auth."id" IN (${Prisma.join(instagramAuthIds)})
              `,
          tiktokAuthIds.length === 0
            ? []
            : ctx.db.$queryRaw<
                Array<SyncLogRow & { status: TikTokSyncStatus }>
              >`
                SELECT
                  auth."id" AS "authId",
                  l."id",
                  l."status"::text AS "status",
                  l."videosProcessed",
                  l."videosUpdated",
                  l."videosFailed",
                  l."errorMessage",
                  l."startedAt",
                  l."completedAt",
                  l."createdAt"
                FROM "TikTokConnection" auth
                CROSS JOIN LATERAL (
                  SELECT
                    log."id", log."status", log."videosProcessed",
                    log."videosUpdated", log."videosFailed",
                    log."errorMessage", log."startedAt",
                    log."completedAt", log."createdAt"
                  FROM "TikTokSyncLog" log
                  WHERE log."tiktokConnectionId" = auth."id"
                  ORDER BY log."createdAt" DESC, log."id" DESC
                  LIMIT 1
                ) l
                WHERE auth."id" IN (${Prisma.join(tiktokAuthIds)})
              `,
        ]);

      const youtubeLogs = new Map(
        youtubeLogRows.map(({ authId, ...log }) => [authId, log]),
      );
      const instagramLogs = new Map(
        instagramLogRows.map(({ authId, ...log }) => [authId, log]),
      );
      const tiktokLogs = new Map(
        tiktokLogRows.map(({ authId, ...log }) => [authId, log]),
      );
      const latestLog = <T>(logs: Map<string, T>, authId: string) => {
        const log = logs.get(authId);
        return log ? [log] : [];
      };

      return accounts.map((account) => ({
        ...account,
        youtubeAuth: account.youtubeAuth
          ? {
              ...account.youtubeAuth,
              syncLogs: latestLog(youtubeLogs, account.youtubeAuth.id),
            }
          : null,
        instagramAuth: account.instagramAuth
          ? {
              ...account.instagramAuth,
              syncLogs: latestLog(instagramLogs, account.instagramAuth.id),
            }
          : null,
        tiktokAuth: account.tiktokAuth
          ? {
              ...account.tiktokAuth,
              syncLogs: latestLog(tiktokLogs, account.tiktokAuth.id),
            }
          : null,
      }));
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
                endDate: true,
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
            message: application.status === "WITHDRAWN"
              ? "Você saiu desta competição e não pode enviar novos posts."
              : "Sua inscrição ainda não foi aprovada",
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
        // (uma consulta para o lote inteiro, no índice platformVideoId+platform)
        if (videoIdsToCheck.length > 0) {
          let existingVideos: Array<{
            platformVideoId: string | null;
            platform: string;
            campaign: { name: string };
            application: {
              clipperProfile: { fullName: string; artisticName: string | null };
            };
          }> = [];
          try {
            existingVideos = await ctx.db.clipPost.findMany({
              where: {
                OR: videoIdsToCheck.map(({ platformVideoId, platform }) => ({
                  platformVideoId,
                  platform: platform as
                    | "INSTAGRAM"
                    | "TIKTOK"
                    | "YOUTUBE"
                    | "KWAI"
                    | "FACEBOOK",
                })),
              },
              select: {
                platformVideoId: true,
                platform: true,
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
          } catch (error) {
            // Mesmo comportamento de antes: falha na checagem não bloqueia o envio
            console.error("Erro ao verificar platformVideoIds:", error);
          }

          // Primeiro vídeo do lote (na ordem enviada) que já existe
          const firstDuplicate = videoIdsToCheck
            .map(({ platformVideoId, platform }) =>
              existingVideos.find(
                (video) =>
                  video.platformVideoId === platformVideoId &&
                  video.platform === platform,
              ),
            )
            .find((video) => video !== undefined);
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
        const createdPosts = await ctx.db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT id FROM "ClipperApplication" WHERE id = ${application.id} FOR UPDATE`;
          const current = await tx.clipperApplication.findUnique({
            where: { id: application.id },
            select: {
              status: true,
              campaign: { select: { status: true, endDate: true } },
            },
          });
          if (!current || current.status !== "APPROVED") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Sua inscrição não permite enviar novos posts.",
            });
          }
          if (
            current.campaign.status !== "ACTIVE" ||
            current.campaign.endDate <= new Date()
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Esta competição não está aberta para novos posts.",
            });
          }
          // Valida todas as plataformas antes de gravar (o primeiro erro, na
          // ordem do lote, aborta a transação inteira, como antes).
          const postsToCreate = postsWithResolvedUrls.flatMap((post) => {
            const account = socialAccounts.find((acc) => acc.id === post.accountId);
            if (!account) return [];

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

            return [
              {
                campaignId: input.campaignId,
                applicationId: application.id,
                platform: account.platform,
                submittedUrl: post.url,
                normalizedUrl:
                  account.platform === "TIKTOK" ? post.url : undefined,
                platformVideoId: platformVideoId, // Salvar shortcode extraído da URL
                username: account.username, // Salvar username da conta social
                status: "PENDING" as const, // Posts começam pendentes de validação
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0,
              },
            ];
          });

          // Um INSERT para o lote (antes: um create por post)
          return postsToCreate.length > 0
            ? tx.clipPost.createManyAndReturn({ data: postsToCreate })
            : [];
        });

        return {
          success: true,
          postsCreated: createdPosts.length,
          posts: createdPosts,
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

  // Buscar competição com menos clipadores (para destaque no home)
  getNextAvailableCompetition: privateProcedure.query(async ({ ctx }) => {
    try {
      // Perfil buscado uma vez por requisição (compartilhado no batch)
      const clipperProfileId = await ctx.getClipperProfileId();
      const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;

      if (!clipperProfile) {
        return null;
      }

      const now = new Date();

      // Competições ativas + participantes aprovados: mesmo cache (60 s) do
      // cronograma. Apenas em andamento (já começaram e ainda não terminaram),
      // publicadas e não privadas (clipadores não podem se inscrever nelas).
      const { campaigns, participantsByCampaign } =
        await getCachedActiveCampaigns(ctx.db);
      const upcomingCampaigns = campaigns.filter(
        (campaign) =>
          !campaign.isPrivate &&
          campaign.publishedAt !== null &&
          campaign.startDate.getTime() <= now.getTime() &&
          campaign.endDate.getTime() >= now.getTime(),
      );

      // Applications do clipper nessas campanhas
      const campaignIds = upcomingCampaigns.map((c) => c.id);
      const existingApplications =
        campaignIds.length > 0
          ? await ctx.db.clipperApplication.findMany({
              where: {
                campaignId: { in: campaignIds },
                clipperProfileId: clipperProfile.id,
              },
              select: { campaignId: true },
            })
          : [];

      const enrolledCampaignIds = new Set(
        existingApplications.map((a) => a.campaignId),
      );

      const availableCampaigns: Array<{
        campaign: (typeof upcomingCampaigns)[0];
        totalApplications: number;
      }> = upcomingCampaigns
        .filter((c) => !enrolledCampaignIds.has(c.id))
        .map((c) => ({
          campaign: c,
          totalApplications: participantsByCampaign.get(c.id) ?? 0,
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
      // Perfil buscado uma vez por requisição (compartilhado no batch)
      const clipperProfileId = await ctx.getClipperProfileId();
      const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;

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

      // Vídeos enviados (todos os status) por inscrição: groupBy só nas
      // inscrições do clipador, em vez do `_count` que agrega o ClipPost inteiro.
      const postCounts =
        applications.length > 0
          ? await ctx.db.clipPost.groupBy({
              by: ["applicationId"],
              where: {
                applicationId: { in: applications.map((app) => app.id) },
              },
              _count: { id: true },
            })
          : [];
      const postCountByApplication = new Map(
        postCounts.map((row) => [row.applicationId, row._count.id]),
      );

      return applications.map((application) => ({
        ...application,
        postedVideoCount: postCountByApplication.get(application.id) ?? 0,
      }));
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
  // Mesmo payload de antes, montado com as consultas de cada aba (a página
  // usa as procedures por aba abaixo; esta serve de comparação/compat).
  getRankingData: adminProcedure.query(({ ctx }) =>
    withRankingError(async () => {
      const [
        topClippersByViews,
        topClippersByEarnings,
        platforms,
        competitionRankings,
        champions,
        stats,
      ] = await Promise.all([
        loadRankingByViews(ctx.db),
        loadRankingByEarnings(ctx.db),
        loadRankingByPlatform(ctx.db),
        loadRankingByCompetition(ctx.db),
        loadRankingChampions(ctx.db),
        loadRankingSummary(ctx.db),
      ]);

      return {
        topClippersByViews,
        topClippersByEarnings,
        platformRankings: platforms.platformRankings,
        competitionRankings,
        champions: champions.champions,
        topChampions: champions.topChampions,
        platformDistribution: platforms.platformDistribution,
        stats,
      };
    }),
  ),

  // Abas do /clippers/ranking (somente ADMIN): cada aba busca só o que
  // mostra, quando é aberta. Resultados em cache por alguns minutos.
  getRankingSummary: adminProcedure.query(({ ctx }) =>
    withRankingError(() => loadRankingSummary(ctx.db)),
  ),

  getRankingByViews: adminProcedure.query(({ ctx }) =>
    withRankingError(() => loadRankingByViews(ctx.db)),
  ),

  getRankingChampions: adminProcedure.query(({ ctx }) =>
    withRankingError(() => loadRankingChampions(ctx.db)),
  ),

  getRankingByPlatform: adminProcedure.query(({ ctx }) =>
    withRankingError(() => loadRankingByPlatform(ctx.db)),
  ),

  getRankingByCompetition: adminProcedure.query(({ ctx }) =>
    withRankingError(() => loadRankingByCompetition(ctx.db)),
  ),

  getRankingByEarnings: adminProcedure.query(({ ctx }) =>
    withRankingError(() => loadRankingByEarnings(ctx.db)),
  ),

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
            status: true,
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

        if (application.status === "WITHDRAWN") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você saiu desta competição e não pode vincular contas." });
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
        await ctx.db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT id FROM "ClipperApplication" WHERE id = ${application.id} FOR UPDATE`;
          const current = await tx.clipperApplication.findUnique({
            where: { id: application.id }, select: { status: true },
          });
          if (!current || current.status === "WITHDRAWN") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Você saiu desta competição e não pode vincular contas." });
          }
          await Promise.all(
            socialAccounts.map((account) =>
              tx.applicationSocialAccount.create({
                data: {
                  applicationId: application.id,
                  accountId: account.id,
                },
              }),
            ),
          );
        });

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

    // Igual para todos os clipadores: cache de 10 min por instância.
    const ranking = await cachedQuery(
      "clipper:top-clippers-30d",
      10 * 60 * 1000,
      async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Soma dos posts elegíveis dos últimos 30 dias por clipador, no banco;
        // os totais da plataforma vêm das funções de janela (antes do LIMIT).
        const rows = await ctx.db.$queryRaw<
          Array<{
            clipperProfileId: string;
            views: bigint;
            likes: bigint;
            comments: bigint;
            shares: bigint;
            saves: bigint;
            posts: number;
            totalClippers: number;
            totalViews: bigint;
            totalPosts: bigint;
          }>
        >`
          WITH per_clipper AS (
            SELECT
              a."clipperProfileId",
              COALESCE(SUM(p."views"), 0)::bigint AS "views",
              COALESCE(SUM(p."likes"), 0)::bigint AS "likes",
              COALESCE(SUM(p."comments"), 0)::bigint AS "comments",
              COALESCE(SUM(p."shares"), 0)::bigint AS "shares",
              COALESCE(SUM(p."saves"), 0)::bigint AS "saves",
              COUNT(*)::int AS "posts"
            FROM "ClipPost" p
            INNER JOIN "ClipperApplication" a ON a."id" = p."applicationId"
            WHERE p."status" = 'ELIGIBLE'
              AND p."createdAt" >= ${thirtyDaysAgo}::timestamp
            GROUP BY a."clipperProfileId"
          )
          SELECT
            pc.*,
            (COUNT(*) OVER ())::int AS "totalClippers",
            (SUM(pc."views") OVER ())::bigint AS "totalViews",
            (SUM(pc."posts") OVER ())::bigint AS "totalPosts"
          FROM per_clipper pc
          ORDER BY pc."views" DESC, pc."clipperProfileId" ASC
          LIMIT 10
        `;

        const profiles =
          rows.length > 0
            ? await ctx.db.clipperProfile.findMany({
                where: { id: { in: rows.map((row) => row.clipperProfileId) } },
                select: {
                  id: true,
                  fullName: true,
                  artisticName: true,
                  instagramUsernames: true,
                  user: { select: { name: true, imageUrl: true } },
                  clan: { select: { tag: true, emoji: true, emojiColor: true } },
                  socialAccounts: {
                    where: { isPrimary: true },
                    take: 1,
                    select: { username: true },
                  },
                },
              })
            : [];
        const profileById = new Map(
          profiles.map((profile) => [profile.id, profile]),
        );

        const topClippers = rows.map((row, index) => {
          const profile = profileById.get(row.clipperProfileId);
          if (!profile) return null;

          const stats = {
            views: Number(row.views),
            likes: Number(row.likes),
            comments: Number(row.comments),
            shares: Number(row.shares),
            saves: Number(row.saves),
            posts: Number(row.posts),
          };
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
            profileId: row.clipperProfileId,
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
        });

        const first = rows[0];
        return {
          topClippers,
          totalClippers: first ? Number(first.totalClippers) : 0,
          totalViews: first ? Number(first.totalViews) : 0,
          totalPosts: first ? Number(first.totalPosts) : 0,
        };
      },
    );

    const currentMonth = now.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    return {
      clippers: ranking.topClippers.filter(Boolean),
      totalClippers: ranking.totalClippers,
      totalViews: ranking.totalViews,
      totalPosts: ranking.totalPosts,
      currentMonth,
    };
  }),
});
