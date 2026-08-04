/**
 * Helpers para cálculo de rankings e premiações
 * Sistema suporta VIEWS e VIEWS_X_ENGAGEMENT
 */

import { formatBRLNumber } from "@/lib/currency"

// ============================================================================
// TIPOS
// ============================================================================

// Tipo de métrica usada para calcular o ranking
export type RankingMetricType = "VIEWS" | "VIEWS_X_ENGAGEMENT"

export interface DailyPrizeTable {
  [position: string]: number // Ex: { "1": 350, "2": 200, "3": 150, "4-15": 25 }
}

export interface MonthlyPrizeTable {
  [position: string]: number // Ex: { "1": 7000, "2": 4000, ... "10": 400 }
}

export type TiebreakerRule = 
  | "views_6h"        // Mais views nas primeiras 6h
  | "views_12h"       // Mais views nas primeiras 12h
  | "posted_earlier"  // Postou mais cedo
  | "videos_100k"     // Mais vídeos com +100k views
  | "videos_500k"     // Mais vídeos com +500k views
  | "peak_views"      // Maior pico de views
  | "first_post"      // Primeiro envio válido

export interface RankingRuleConfig {
  // Diária
  dailyEnabled: boolean
  dailyTopCount: number
  dailyTotalPrize: number
  dailyTotalMonthBudget: number
  dailyPrizeTable: DailyPrizeTable
  dailyTiebreakerRules: TiebreakerRule[]
  
  // Bônus
  bonusEnabled: boolean
  bonusMilestone: number
  bonusAmount: number
  bonusDeductFromDaily: boolean
  bonusMonthlyBudgetCap?: number
  
  // Mensal
  monthlyEnabled: boolean
  monthlyTopCount: number
  monthlyTotalPrize: number
  monthlyPrizeTable: MonthlyPrizeTable
  monthlyTiebreakerRules: TiebreakerRule[]
  monthlyThreshold100k: number
  monthlyThreshold500k: number
}

// ============================================================================
// CÁLCULO DE PRÊMIOS DIÁRIOS
// ============================================================================

/**
 * Calcula o prêmio diário para uma posição específica
 */
export function calculateDailyPrize(
  position: number,
  prizeTable: DailyPrizeTable
): number {
  // Verificar se há prêmio para a posição exata
  if (prizeTable[position.toString()]) {
    return prizeTable[position.toString()]!
  }
  
  // Verificar se há prêmio para range (ex: "4-15")
  for (const [key, value] of Object.entries(prizeTable)) {
    if (key.includes('-')) {
      const [start, end] = key.split('-').map(Number)
      if (start && end && position >= start && position <= end) {
        return value
      }
    }
  }
  
  return 0
}

/**
 * Verifica se um vídeo qualifica para bônus de milestone
 */
export function qualifiesForMilestoneBonus(
  totalViews: number,
  milestone: number
): boolean {
  return totalViews >= milestone
}

/**
 * Calcula o total de prêmios diários já distribuídos no mês
 */
export function calculateDailyPrizesDistributed(
  daysPassed: number,
  prizePerDay: number
): number {
  return daysPassed * prizePerDay
}

/**
 * Calcula quanto ainda resta do budget de bônus mensal
 */
export function calculateRemainingBonusBudget(
  totalBonusesPaid: number,
  monthlyCap?: number
): number {
  if (!monthlyCap) return Infinity
  return Math.max(0, monthlyCap - totalBonusesPaid)
}

// ============================================================================
// CÁLCULO DE PRÊMIOS MENSAIS
// ============================================================================

/**
 * Calcula o prêmio mensal para uma posição específica
 */
export function calculateMonthlyPrize(
  position: number,
  prizeTable: MonthlyPrizeTable
): number {
  return prizeTable[position.toString()] || 0
}

/**
 * Conta quantos vídeos ultrapassaram um threshold
 */
export function countVideosOverThreshold(
  videoViews: number[],
  threshold: number
): number {
  return videoViews.filter(views => views >= threshold).length
}

/**
 * Encontra o pico de views (melhor vídeo)
 */
export function findPeakViews(videoViews: number[]): number {
  return Math.max(...videoViews, 0)
}

// ============================================================================
// DESEMPATE
// ============================================================================

/**
 * Compara dois participantes para desempate no ranking diário
 * Retorna: -1 se a vence, 1 se b vence, 0 se empate
 */
export function compareDailyTiebreaker(
  a: {
    dailyViews: number
    dailyRankingScore?: number
    viewsFirst6h?: number
    viewsFirst12h?: number
    postedAt?: Date
  },
  b: {
    dailyViews: number
    dailyRankingScore?: number
    viewsFirst6h?: number
    viewsFirst12h?: number
    postedAt?: Date
  },
  rules: TiebreakerRule[],
  metricType: RankingMetricType = "VIEWS"
): number {
  // Primeiro critério: score de ranking (depende do tipo de métrica)
  if (metricType === "VIEWS_X_ENGAGEMENT" && a.dailyRankingScore !== undefined && b.dailyRankingScore !== undefined) {
    if (a.dailyRankingScore !== b.dailyRankingScore) {
      return b.dailyRankingScore - a.dailyRankingScore
    }
  } else if (a.dailyViews !== b.dailyViews) {
    return b.dailyViews - a.dailyViews
  }
  
  // Aplicar regras de desempate em ordem
  for (const rule of rules) {
    switch (rule) {
      case "views_6h":
        if (a.viewsFirst6h !== undefined && b.viewsFirst6h !== undefined) {
          if (a.viewsFirst6h !== b.viewsFirst6h) {
            return b.viewsFirst6h - a.viewsFirst6h
          }
        }
        break
        
      case "views_12h":
        if (a.viewsFirst12h !== undefined && b.viewsFirst12h !== undefined) {
          if (a.viewsFirst12h !== b.viewsFirst12h) {
            return b.viewsFirst12h - a.viewsFirst12h
          }
        }
        break
        
      case "posted_earlier":
        if (a.postedAt && b.postedAt) {
          const diff = a.postedAt.getTime() - b.postedAt.getTime()
          if (diff !== 0) {
            return diff // Negativo se a postou antes (vence)
          }
        }
        break
    }
  }
  
  return 0 // Empate total
}

/**
 * Compara dois participantes para desempate no ranking mensal
 * Retorna: -1 se a vence, 1 se b vence, 0 se empate
 */
export function compareMonthlyTiebreaker(
  a: {
    totalViews: number
    rankingScore?: number
    videosOver100k: number
    videosOver500k: number
    peakViews: number
    firstPostDate?: Date
  },
  b: {
    totalViews: number
    rankingScore?: number
    videosOver100k: number
    videosOver500k: number
    peakViews: number
    firstPostDate?: Date
  },
  rules: TiebreakerRule[],
  metricType: RankingMetricType = "VIEWS"
): number {
  // Primeiro critério: score de ranking (depende do tipo de métrica)
  if (metricType === "VIEWS_X_ENGAGEMENT" && a.rankingScore !== undefined && b.rankingScore !== undefined) {
    if (a.rankingScore !== b.rankingScore) {
      return b.rankingScore - a.rankingScore
    }
  } else if (a.totalViews !== b.totalViews) {
    return b.totalViews - a.totalViews
  }
  
  // Aplicar regras de desempate em ordem
  for (const rule of rules) {
    switch (rule) {
      case "videos_100k":
        if (a.videosOver100k !== b.videosOver100k) {
          return b.videosOver100k - a.videosOver100k
        }
        break
        
      case "videos_500k":
        if (a.videosOver500k !== b.videosOver500k) {
          return b.videosOver500k - a.videosOver500k
        }
        break
        
      case "peak_views":
        if (a.peakViews !== b.peakViews) {
          return b.peakViews - a.peakViews
        }
        break
        
      case "first_post":
        if (a.firstPostDate && b.firstPostDate) {
          const diff = a.firstPostDate.getTime() - b.firstPostDate.getTime()
          if (diff !== 0) {
            return diff // Negativo se a postou antes (vence)
          }
        }
        break
    }
  }
  
  return 0 // Empate total
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================

/**
 * Valida se a tabela de prêmios diária soma o valor esperado
 */
export function validateDailyPrizeTable(
  prizeTable: DailyPrizeTable,
  expectedTotal: number,
  topCount: number
): { valid: boolean; error?: string; calculatedTotal?: number } {
  let total = 0
  let positionsCovered = 0
  
  for (const [key, value] of Object.entries(prizeTable)) {
    if (key.includes('-')) {
      const [start, end] = key.split('-').map(Number)
      if (start && end) {
        const count = end - start + 1
        total += value * count
        positionsCovered += count
      }
    } else {
      total += value
      positionsCovered += 1
    }
  }
  
  if (positionsCovered !== topCount) {
    return {
      valid: false,
      error: `Tabela cobre ${positionsCovered} posições, esperado ${topCount}`,
      calculatedTotal: total
    }
  }
  
  if (Math.abs(total - expectedTotal) > 0.01) {
    return {
      valid: false,
      error: `Soma dos prêmios (${formatBRLNumber(total)}) difere do esperado (${formatBRLNumber(expectedTotal)})`,
      calculatedTotal: total
    }
  }
  
  return { valid: true, calculatedTotal: total }
}

/**
 * Valida se a tabela de prêmios mensal soma o valor esperado
 */
export function validateMonthlyPrizeTable(
  prizeTable: MonthlyPrizeTable,
  expectedTotal: number,
  topCount: number
): { valid: boolean; error?: string; calculatedTotal?: number } {
  let total = 0
  let positionsCovered = 0
  
  for (const [key, value] of Object.entries(prizeTable)) {
    total += value
    positionsCovered += 1
  }
  
  if (positionsCovered !== topCount) {
    return {
      valid: false,
      error: `Tabela cobre ${positionsCovered} posições, esperado ${topCount}`,
      calculatedTotal: total
    }
  }
  
  if (Math.abs(total - expectedTotal) > 0.01) {
    return {
      valid: false,
      error: `Soma dos prêmios (${formatBRLNumber(total)}) difere do esperado (${formatBRLNumber(expectedTotal)})`,
      calculatedTotal: total
    }
  }
  
  return { valid: true, calculatedTotal: total }
}

// ============================================================================
// FORMATAÇÃO
// ============================================================================

/**
 * Formata valor monetário em BRL
 */
export function formatPrize(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formata número de views (1.5M, 250k, etc)
 */
export function formatViews(views: number): string {
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M`
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1)}k`
  }
  return views.toString()
}

// ============================================================================
// CÁLCULO DE RANKING SCORE (VIEWS ou VIEWS x ENGAGEMENT)
// ============================================================================

/** Alinha ao PostgreSQL TRUNC(n, 2) para valores não negativos (ER %). */
export function truncateEngagementPercentTo2Decimals(percent: number): number {
  return Math.trunc(percent * 100) / 100
}

/**
 * Taxa de engajamento em % (likes + comments + shares + saves) / views × 100,
 * truncada em 2 casas — igual ao SQL do ranking diário (DailyRankingEntry).
 */
export function calculateEngagementRate(
  views: number,
  likes: number,
  comments: number,
  shares: number,
  saves = 0
): number {
  if (views === 0) return 0
  const rawPercent =
    ((likes + comments + shares + saves) / views) * 100
  return truncateEngagementPercentTo2Decimals(rawPercent)
}

/**
 * Calcula o score de ranking baseado no tipo de métrica
 *
 * VIEWS: score = views
 * VIEWS_X_ENGAGEMENT: TRUNC(views × TRUNC(ER%, 2)) como no SQL do preview diário.
 */
export function calculateRankingScore(
  metricType: RankingMetricType,
  views: number,
  likes: number,
  comments: number,
  shares: number,
  saves = 0
): number {
  if (metricType === "VIEWS") {
    return views
  }

  const erPercent = calculateEngagementRate(
    views,
    likes,
    comments,
    shares,
    saves
  )
  return Math.trunc(views * erPercent)
}

/**
 * Calcula o score de ranking para um conjunto de posts
 */
export function calculateTotalRankingScore(
  metricType: RankingMetricType,
  posts: Array<{
    views: number
    likes: number
    comments: number
    shares: number
    saves?: number
  }>
): number {
  if (metricType === "VIEWS") {
    return posts.reduce((sum, post) => sum + post.views, 0)
  }

  return posts.reduce((sum, post) => {
    return (
      sum +
      calculateRankingScore(
        metricType,
        post.views,
        post.likes,
        post.comments,
        post.shares,
        post.saves ?? 0
      )
    )
  }, 0)
}

/**
 * Retorna o label legível para o tipo de métrica
 */
export function getRankingMetricLabel(metricType: RankingMetricType): string {
  switch (metricType) {
    case "VIEWS":
      return "Views"
    case "VIEWS_X_ENGAGEMENT":
      return "Views × Engajamento"
    default:
      return "Views"
  }
}

/**
 * Retorna a descrição do tipo de métrica
 */
export function getRankingMetricDescription(metricType: RankingMetricType): string {
  switch (metricType) {
    case "VIEWS":
      return "Ranking baseado apenas na quantidade de visualizações"
    case "VIEWS_X_ENGAGEMENT":
      return "Ranking baseado em views multiplicado pela taxa de engajamento"
    default:
      return "Ranking baseado em views"
  }
}

