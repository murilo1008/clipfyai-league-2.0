import { formatInTimeZone } from "date-fns-tz";

import {
  SANDBOX_PLATFORMS,
  SANDBOX_STATUSES,
  newSandboxRowId,
  uniqueTags,
  type SandboxData,
  type SandboxGrowthPoint,
  type SandboxPlatform,
} from "@/lib/competition-sandbox";
import {
  getPrizeForPosition,
  parsePrizeTable,
} from "@/lib/daily-ranking-preview";

/*
 * Converte o que a página da competição mostra (getCompetitionDetailsAdmin +
 * getCompetitionChartsAdmin) no snapshot editável do sandbox. Os tipos abaixo
 * são só os campos lidos, para não amarrar este módulo ao tipo do router.
 */

type Numeric = number | bigint | string | null | undefined;

export type SandboxSourceDetails = {
  campaign: {
    name: string;
    description: string | null;
    coverImageUrl: string | null;
    status: string;
    startDate: string;
    endDate: string;
    platforms: string[];
    requiredHashtags: string[];
    requiredMentions: string[];
    totalPrize: string;
    isPrivate: boolean;
    isProOnly: boolean;
    rankingMetricType: string | null;
  };
  stats: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    totalClippers: number;
    totalPosts: number;
    engagementRate: number;
  };
  topMonthlyRanking: Array<{
    position: number;
    clipperName: string;
    clipperUsername: string;
    clipperImageUrl: string | null;
    clanTag: string | null;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    postsCount: number;
    engagementRate: number;
  }>;
  topAccountsRanking: Array<{
    username: string;
    platform: string;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    postsCount: number;
    engagementRate: number;
  }>;
  topPostsForReport: Array<{
    id: string;
    url: string;
    platform: string;
    username: string;
    clipperName: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    postedAt?: string | null;
  }>;
  rankingRule: {
    dailyEnabled: boolean;
    dailyTopCount: number;
    dailyTotalPrize: Numeric;
    monthlyEnabled: boolean;
    monthlyTopCount: number;
    monthlyTotalPrize: Numeric;
    monthlyPrizeTable: unknown;
    bonusEnabled: boolean;
    bonusMilestone: Numeric;
    bonusAmount: Numeric;
  } | null;
};

export type SandboxSourceCharts = {
  platformDistribution: Array<{
    platform: string;
    posts: Numeric;
    views: Numeric;
    likes: Numeric;
    comments: Numeric;
    shares: Numeric;
    saves: Numeric;
  }>;
  platformGrowthData: Array<Record<string, number | string>>;
  growthPlatforms: string[];
};

const SAO_PAULO = "America/Sao_Paulo";

function toNumber(value: Numeric): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isPlatform(value: string): value is SandboxPlatform {
  return (SANDBOX_PLATFORMS as readonly string[]).includes(value);
}

/** Plataformas fora do enum (não deveriam existir) viram Instagram. */
function toPlatform(value: string): SandboxPlatform {
  return isPlatform(value) ? value : "INSTAGRAM";
}

function toYmd(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, SAO_PAULO, "yyyy-MM-dd");
}

function truncate(value: string | null | undefined, max: number): string {
  return (value ?? "").slice(0, max);
}

/** Tabela de prêmios inválida não impede a importação: os prêmios saem 0. */
function safePrizeTable(raw: unknown) {
  try {
    return parsePrizeTable(raw ?? null, { allowEmpty: true });
  } catch {
    return [];
  }
}

export function buildSandboxSnapshot({
  details,
  charts,
}: {
  details: SandboxSourceDetails;
  charts: SandboxSourceCharts | null;
}): SandboxData {
  const { campaign, stats, rankingRule } = details;
  const monthlyPrizeTable = safePrizeTable(rankingRule?.monthlyPrizeTable);
  const totalPrize = campaign.totalPrize.trim();

  const growthPlatforms = (charts?.growthPlatforms ?? []).filter(isPlatform);
  const growth: SandboxGrowthPoint[] = (charts?.platformGrowthData ?? [])
    .slice(-1000)
    .flatMap((row) => {
      const date = typeof row.date === "string" ? row.date : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      const point: SandboxGrowthPoint = {
        id: newSandboxRowId(),
        date,
        total: toNumber(row.total as Numeric),
      };
      for (const platform of growthPlatforms) {
        point[platform] = toNumber(row[platform] as Numeric);
      }
      return [point];
    });

  const seenPlatforms = new Set<SandboxPlatform>();
  const platformDistribution = (charts?.platformDistribution ?? []).flatMap(
    (row) => {
      if (!isPlatform(row.platform) || seenPlatforms.has(row.platform)) {
        return [];
      }
      seenPlatforms.add(row.platform);
      return [
        {
          id: newSandboxRowId(),
          platform: row.platform,
          posts: toNumber(row.posts),
          views: toNumber(row.views),
          likes: toNumber(row.likes),
          comments: toNumber(row.comments),
          shares: toNumber(row.shares),
          saves: toNumber(row.saves),
        },
      ];
    },
  );

  return {
    version: 1,
    campaign: {
      name: campaign.name.trim().slice(0, 200).trim() || "Competição",
      description: truncate(campaign.description, 5000),
      coverImageUrl: truncate(campaign.coverImageUrl, 2000),
      status: (SANDBOX_STATUSES as readonly string[]).includes(campaign.status)
        ? (campaign.status as SandboxData["campaign"]["status"])
        : "DRAFT",
      startDate: toYmd(campaign.startDate),
      endDate: toYmd(campaign.endDate),
      platforms: [...new Set(campaign.platforms.filter(isPlatform))],
      requiredHashtags: uniqueTags(
        campaign.requiredHashtags.map((tag) => tag.trim().slice(0, 100)),
        "#",
      ).slice(0, 50),
      requiredMentions: uniqueTags(
        campaign.requiredMentions.map((mention) =>
          mention.trim().slice(0, 100),
        ),
        "@",
      ).slice(0, 50),
      totalPrize:
        totalPrize === "R$ 0" || totalPrize === "0"
          ? ""
          : totalPrize.slice(0, 200),
      isPrivate: campaign.isPrivate,
      isProOnly: campaign.isProOnly,
      rankingMetricType:
        campaign.rankingMetricType === "VIEWS_X_ENGAGEMENT"
          ? "VIEWS_X_ENGAGEMENT"
          : "VIEWS",
    },
    stats: {
      totalViews: toNumber(stats.totalViews),
      totalLikes: toNumber(stats.totalLikes),
      totalComments: toNumber(stats.totalComments),
      totalShares: toNumber(stats.totalShares),
      totalSaves: toNumber(stats.totalSaves),
      totalClippers: toNumber(stats.totalClippers),
      totalPosts: toNumber(stats.totalPosts),
      engagementRate: toNumber(stats.engagementRate),
    },
    prizes: {
      dailyEnabled: rankingRule?.dailyEnabled ?? false,
      dailyTopCount: Math.min(toNumber(rankingRule?.dailyTopCount), 100_000),
      dailyTotalPrize: toNumber(rankingRule?.dailyTotalPrize),
      monthlyEnabled: rankingRule?.monthlyEnabled ?? false,
      monthlyTopCount: Math.min(
        toNumber(rankingRule?.monthlyTopCount),
        100_000,
      ),
      monthlyTotalPrize: toNumber(rankingRule?.monthlyTotalPrize),
      bonusEnabled: rankingRule?.bonusEnabled ?? false,
      bonusMilestone: toNumber(rankingRule?.bonusMilestone),
      bonusAmount: toNumber(rankingRule?.bonusAmount),
    },
    platformDistribution,
    growthPlatforms,
    growth,
    monthlyRanking: details.topMonthlyRanking.slice(0, 200).map((row) => ({
      id: newSandboxRowId(),
      clipperName: truncate(row.clipperName, 200),
      clipperUsername: truncate(row.clipperUsername, 200),
      clipperImageUrl: truncate(row.clipperImageUrl, 2000),
      clanTag: truncate(row.clanTag, 20),
      totalViews: toNumber(row.totalViews),
      totalLikes: toNumber(row.totalLikes),
      totalComments: toNumber(row.totalComments),
      totalShares: toNumber(row.totalShares),
      totalSaves: toNumber(row.totalSaves),
      postsCount: toNumber(row.postsCount),
      engagementRate: toNumber(row.engagementRate),
      prize: getPrizeForPosition(monthlyPrizeTable, row.position),
    })),
    accountsRanking: details.topAccountsRanking.slice(0, 200).map((row) => ({
      id: newSandboxRowId(),
      username: truncate(row.username, 200),
      platform: toPlatform(row.platform),
      totalViews: toNumber(row.totalViews),
      totalLikes: toNumber(row.totalLikes),
      totalComments: toNumber(row.totalComments),
      totalShares: toNumber(row.totalShares),
      totalSaves: toNumber(row.totalSaves),
      postsCount: toNumber(row.postsCount),
      engagementRate: toNumber(row.engagementRate),
    })),
    topPosts: details.topPostsForReport.slice(0, 100).map((post) => ({
      id: newSandboxRowId(),
      sourcePostId: truncate(post.id, 40),
      url: truncate(post.url, 2000),
      // A URL assinada do CDN expira; a tela usa a thumbnail atual do post
      thumbnailUrl: "",
      platform: toPlatform(post.platform),
      username: truncate(post.username, 200),
      clipperName: truncate(post.clipperName, 200),
      views: toNumber(post.views),
      likes: toNumber(post.likes),
      comments: toNumber(post.comments),
      shares: toNumber(post.shares),
      postedAt: toYmd(post.postedAt),
    })),
  };
}
