import { z } from "zod";

import { calculateEngagementRate } from "@/lib/ranking-helpers";

/**
 * Sandbox de competição: snapshot editável dos dados de uma competição.
 *
 * O snapshot é gravado como JSON em `CompetitionSandbox.data` e só é lido pela
 * tela de sandbox do admin. Nenhum campo aqui volta para a competição real.
 * Valores são livres: o admin pode deixar KPIs, gráficos e rankings
 * incoerentes entre si de propósito.
 */

export const SANDBOX_PLATFORMS = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "KWAI",
  "FACEBOOK",
] as const;
export type SandboxPlatform = (typeof SANDBOX_PLATFORMS)[number];

export const SANDBOX_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;

const platformSchema = z.enum(SANDBOX_PLATFORMS);
const metricSchema = z.number().finite().min(0).max(1e15);
const moneySchema = z.number().finite().min(0).max(1e12);
const rateSchema = z.number().finite().min(0).max(1e6);
const countSchema = z.number().int().min(0).max(100_000);
const urlSchema = z.string().trim().max(2000);
const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use datas no formato AAAA-MM-DD");
const rowIdSchema = z.string().min(1).max(40);

export const sandboxCampaignSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da competição").max(200),
  description: z.string().max(5000),
  coverImageUrl: urlSchema,
  status: z.enum(SANDBOX_STATUSES),
  startDate: ymdSchema,
  endDate: ymdSchema,
  platforms: z.array(platformSchema).max(SANDBOX_PLATFORMS.length),
  requiredHashtags: z.array(z.string().trim().min(1).max(100)).max(50),
  requiredMentions: z.array(z.string().trim().min(1).max(100)).max(50),
  /** Texto livre, como `prizeInfo.total` ("R$ 10.000", "iPhone + bônus"). */
  totalPrize: z.string().trim().max(200),
  isPrivate: z.boolean(),
  isProOnly: z.boolean(),
  rankingMetricType: z.enum(["VIEWS", "VIEWS_X_ENGAGEMENT"]),
});

export const sandboxStatsSchema = z.object({
  totalViews: metricSchema,
  totalLikes: metricSchema,
  totalComments: metricSchema,
  totalShares: metricSchema,
  totalSaves: metricSchema,
  totalClippers: metricSchema,
  totalPosts: metricSchema,
  engagementRate: rateSchema,
});

export const sandboxPrizesSchema = z.object({
  dailyEnabled: z.boolean(),
  dailyTopCount: countSchema,
  dailyTotalPrize: moneySchema,
  monthlyEnabled: z.boolean(),
  monthlyTopCount: countSchema,
  monthlyTotalPrize: moneySchema,
  bonusEnabled: z.boolean(),
  bonusMilestone: metricSchema,
  bonusAmount: moneySchema,
});

export const sandboxPlatformRowSchema = z.object({
  id: rowIdSchema,
  platform: platformSchema,
  posts: metricSchema,
  views: metricSchema,
  likes: metricSchema,
  comments: metricSchema,
  shares: metricSchema,
  saves: metricSchema,
});

/** Ponto do gráfico de crescimento: views acumuladas (total e por rede). */
export const sandboxGrowthPointSchema = z.object({
  id: rowIdSchema,
  date: ymdSchema,
  total: metricSchema,
  INSTAGRAM: metricSchema.optional(),
  TIKTOK: metricSchema.optional(),
  YOUTUBE: metricSchema.optional(),
  KWAI: metricSchema.optional(),
  FACEBOOK: metricSchema.optional(),
});

export const sandboxMonthlyRowSchema = z.object({
  id: rowIdSchema,
  clipperName: z.string().max(200),
  clipperUsername: z.string().max(200),
  clipperImageUrl: urlSchema,
  clanTag: z.string().max(20),
  totalViews: metricSchema,
  totalLikes: metricSchema,
  totalComments: metricSchema,
  totalShares: metricSchema,
  totalSaves: metricSchema,
  postsCount: metricSchema,
  engagementRate: rateSchema,
  prize: moneySchema,
});

export const sandboxAccountRowSchema = z.object({
  id: rowIdSchema,
  username: z.string().max(200),
  platform: platformSchema,
  totalViews: metricSchema,
  totalLikes: metricSchema,
  totalComments: metricSchema,
  totalShares: metricSchema,
  totalSaves: metricSchema,
  postsCount: metricSchema,
  engagementRate: rateSchema,
});

export const sandboxPostRowSchema = z.object({
  id: rowIdSchema,
  /** Post real de origem ("" em posts criados no sandbox). */
  sourcePostId: z.string().max(40),
  url: urlSchema,
  /**
   * "" usa a thumbnail atual do post de origem: as URLs dos CDNs das redes
   * expiram em ~24 h, então o snapshot não guarda a da importação.
   */
  thumbnailUrl: urlSchema,
  platform: platformSchema,
  username: z.string().max(200),
  clipperName: z.string().max(200),
  views: metricSchema,
  likes: metricSchema,
  comments: metricSchema,
  shares: metricSchema,
  /** "" quando a data de postagem não é conhecida. */
  postedAt: z.union([ymdSchema, z.literal("")]),
});

export const sandboxDataSchema = z.object({
  version: z.literal(1),
  campaign: sandboxCampaignSchema,
  stats: sandboxStatsSchema,
  prizes: sandboxPrizesSchema,
  platformDistribution: z
    .array(sandboxPlatformRowSchema)
    .max(SANDBOX_PLATFORMS.length)
    .refine(
      (rows) => new Set(rows.map((row) => row.platform)).size === rows.length,
      "Cada plataforma pode aparecer uma vez só na distribuição",
    ),
  growthPlatforms: z.array(platformSchema).max(SANDBOX_PLATFORMS.length),
  growth: z.array(sandboxGrowthPointSchema).max(1000),
  monthlyRanking: z.array(sandboxMonthlyRowSchema).max(200),
  accountsRanking: z.array(sandboxAccountRowSchema).max(200),
  topPosts: z.array(sandboxPostRowSchema).max(100),
});

export type SandboxData = z.infer<typeof sandboxDataSchema>;
export type SandboxCampaign = SandboxData["campaign"];
export type SandboxStats = SandboxData["stats"];
export type SandboxPrizes = SandboxData["prizes"];
export type SandboxPlatformRow = SandboxData["platformDistribution"][number];
export type SandboxGrowthPoint = SandboxData["growth"][number];
export type SandboxMonthlyRow = SandboxData["monthlyRanking"][number];
export type SandboxAccountRow = SandboxData["accountsRanking"][number];
export type SandboxPostRow = SandboxData["topPosts"][number];

/** Id curto e estável para as linhas editáveis (só serve de `key`). */
export function newSandboxRowId(): string {
  return Math.random().toString(36).slice(2, 12) || "row";
}

const SECTION_LABELS: Record<string, string> = {
  campaign: "Competição",
  stats: "KPIs",
  prizes: "Premiações",
  platformDistribution: "Distribuição por plataforma",
  growthPlatforms: "Crescimento de views",
  growth: "Crescimento de views",
  monthlyRanking: "Ranking mensal",
  accountsRanking: "Ranking de contas",
  topPosts: "Top posts",
};

/**
 * Primeira mensagem de erro do schema com o lugar do campo, na numeração
 * da tela ("Ranking mensal › linha 4 › prize"), não no índice do array.
 */
export function describeSandboxIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Dados inválidos";
  const path = issue.path.map((part, index) =>
    typeof part === "number"
      ? `linha ${part + 1}`
      : index === 0
        ? (SECTION_LABELS[part] ?? part)
        : part,
  );
  return path.length > 0
    ? `${path.join(" › ")}: ${issue.message}`
    : issue.message;
}

/**
 * O prêmio do ranking mensal é da posição, como no sistema: ao reordenar ou
 * remover clipadores, cada posição mantém o seu valor. Edições de célula
 * (mesma ordem, mesmas linhas) passam direto, inclusive a do prêmio.
 */
export function keepPrizesOnPositions<
  Row extends { id: string; prize: number },
>(previous: Row[], next: Row[]): Row[] {
  const sameRows =
    previous.length === next.length &&
    previous.every((row, index) => row.id === next[index]?.id);
  if (sameRows) return next;
  return next.map((row, index) => {
    const prize = previous[index]?.prize;
    return prize === undefined || prize === row.prize ? row : { ...row, prize };
  });
}

/** Lista sem itens repetidos, ignorando "#"/"@" no início e maiúsculas. */
export function uniqueTags(values: string[], prefix: "#" | "@"): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.replace(prefix === "#" ? /^#+/ : /^@+/, "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Mesma fórmula do sistema: (likes + comentários + shares + saves) / views. */
export function computeEngagementRate(stats: {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves?: number;
}): number {
  return calculateEngagementRate(
    stats.totalViews,
    stats.totalLikes,
    stats.totalComments,
    stats.totalShares,
    stats.totalSaves ?? 0,
  );
}

/**
 * Reescala a curva de crescimento para terminar em `targetTotal`, mantendo o
 * formato. Útil depois de editar o total de views nos KPIs.
 */
export function scaleGrowthToTotal(
  points: SandboxGrowthPoint[],
  targetTotal: number,
): SandboxGrowthPoint[] {
  const lastTotal = points.at(-1)?.total ?? 0;
  if (lastTotal <= 0) return points;
  const factor = targetTotal / lastTotal;
  return points.map((point) => {
    const scaled: SandboxGrowthPoint = {
      ...point,
      total: Math.round(point.total * factor),
    };
    for (const platform of SANDBOX_PLATFORMS) {
      const value = point[platform];
      if (value !== undefined) scaled[platform] = Math.round(value * factor);
    }
    return scaled;
  });
}

/** Score do ranking, como no sistema (Views ou Views × Engajamento). */
export function sandboxRankingScore(
  metricType: SandboxCampaign["rankingMetricType"],
  row: { totalViews: number; engagementRate: number },
): number {
  return metricType === "VIEWS_X_ENGAGEMENT"
    ? Math.trunc(row.totalViews * row.engagementRate)
    : row.totalViews;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Curva acumulada linear de `startDate` a `endDate` terminando em `total`,
 * dividida entre as redes na proporção de `shares` (ex.: views por rede).
 */
export function buildLinearGrowth({
  startDate,
  endDate,
  total,
  shares,
}: {
  startDate: string;
  endDate: string;
  total: number;
  shares: Partial<Record<SandboxPlatform, number>>;
}): SandboxGrowthPoint[] {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return [];
  }
  const days = Math.min(Math.round((end - start) / DAY_MS) + 1, 1000);
  const shareEntries = SANDBOX_PLATFORMS.flatMap((platform) => {
    const share = shares[platform] ?? 0;
    return share > 0 ? [[platform, share] as const] : [];
  });
  const shareTotal = shareEntries.reduce((sum, [, share]) => sum + share, 0);

  return Array.from({ length: days }, (_, index) => {
    const pointTotal = Math.round((total * (index + 1)) / days);
    const point: SandboxGrowthPoint = {
      id: newSandboxRowId(),
      date: new Date(start + index * DAY_MS).toISOString().slice(0, 10),
      total: pointTotal,
    };
    for (const [platform, share] of shareEntries) {
      point[platform] = Math.round((pointTotal * share) / shareTotal);
    }
    return point;
  });
}

/** Dia seguinte a "AAAA-MM-DD" (ou hoje, se a data for inválida). */
export function nextYmd(ymd: string | undefined): string {
  const parsed = ymd ? Date.parse(`${ymd}T00:00:00Z`) : Number.NaN;
  const base = Number.isFinite(parsed) ? parsed + DAY_MS : Date.now();
  return new Date(base).toISOString().slice(0, 10);
}
