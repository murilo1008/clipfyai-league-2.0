/**
 * Script de exemplo: Cálculo de Premiações
 * Sistema 100% baseado em VIEWS
 */

import {
  calculateDailyPrize,
  calculateMonthlyPrize,
  qualifiesForMilestoneBonus,
  validateDailyPrizeTable,
  validateMonthlyPrizeTable,
  formatPrize,
  formatViews,
  type DailyPrizeTable,
  type MonthlyPrizeTable,
} from '../src/lib/ranking-helpers'

// ============================================================================
// CONFIGURAÇÃO PADRÃO DA COMPETIÇÃO
// ============================================================================

const DAILY_PRIZE_TABLE: DailyPrizeTable = {
  "1": 350,
  "2": 200,
  "3": 150,
  "4": 25,
  "5": 25,
  "6": 25,
  "7": 25,
  "8": 25,
  "9": 25,
  "10": 25,
  "11": 25,
  "12": 25,
  "13": 25,
  "14": 25,
  "15": 25,
}

const MONTHLY_PRIZE_TABLE: MonthlyPrizeTable = {
  "1": 7000,
  "2": 4000,
  "3": 3000,
  "4": 2000,
  "5": 1000,
  "6": 800,
  "7": 700,
  "8": 600,
  "9": 500,
  "10": 400,
}

const BONUS_MILESTONE = 1_000_000 // 1M views
const BONUS_AMOUNT = 100 // R$ 100

// ============================================================================
// VALIDAÇÃO DAS TABELAS
// ============================================================================

console.log('🔍 Validando tabelas de premiação...\n')

const dailyValidation = validateDailyPrizeTable(DAILY_PRIZE_TABLE, 1000, 15)
if (dailyValidation.valid) {
  console.log('✅ Tabela DIÁRIA válida')
  console.log(`   Total: ${formatPrize(dailyValidation.calculatedTotal!)}`)
  console.log(`   30 dias: ${formatPrize(dailyValidation.calculatedTotal! * 30)}`)
} else {
  console.log('❌ Erro na tabela DIÁRIA:', dailyValidation.error)
}

console.log()

const monthlyValidation = validateMonthlyPrizeTable(MONTHLY_PRIZE_TABLE, 20000, 10)
if (monthlyValidation.valid) {
  console.log('✅ Tabela MENSAL válida')
  console.log(`   Total: ${formatPrize(monthlyValidation.calculatedTotal!)}`)
} else {
  console.log('❌ Erro na tabela MENSAL:', monthlyValidation.error)
}

console.log()
console.log('━'.repeat(80))
console.log()

// ============================================================================
// EXEMPLO 1: CÁLCULO DE PRÊMIO DIÁRIO
// ============================================================================

console.log('📅 EXEMPLO 1: Premiação Diária - Dia 15 de Novembro\n')

interface DailyWinner {
  position: number
  clipper: string
  videoUrl: string
  views: number
  platform: string
}

const dailyTop15: DailyWinner[] = [
  { position: 1, clipper: '@clipador_top', videoUrl: 'tiktok.com/...', views: 1_250_000, platform: 'TikTok' },
  { position: 2, clipper: '@melhor_editor', videoUrl: 'instagram.com/...', views: 890_000, platform: 'Instagram' },
  { position: 3, clipper: '@viral_sempre', videoUrl: 'youtube.com/...', views: 720_000, platform: 'YouTube' },
  { position: 4, clipper: '@clipador_top', videoUrl: 'instagram.com/...', views: 580_000, platform: 'Instagram' },
  { position: 5, clipper: '@editor_pro', videoUrl: 'tiktok.com/...', views: 450_000, platform: 'TikTok' },
  { position: 6, clipper: '@cortes_do_dia', videoUrl: 'instagram.com/...', views: 380_000, platform: 'Instagram' },
  { position: 7, clipper: '@viral_sempre', videoUrl: 'tiktok.com/...', views: 320_000, platform: 'TikTok' },
  { position: 8, clipper: '@clipfy_master', videoUrl: 'youtube.com/...', views: 280_000, platform: 'YouTube' },
  { position: 9, clipper: '@editor_rapido', videoUrl: 'instagram.com/...', views: 250_000, platform: 'Instagram' },
  { position: 10, clipper: '@cortes_incriveis', videoUrl: 'tiktok.com/...', views: 220_000, platform: 'TikTok' },
  { position: 11, clipper: '@editor_pro', videoUrl: 'instagram.com/...', views: 180_000, platform: 'Instagram' },
  { position: 12, clipper: '@viral_videos', videoUrl: 'youtube.com/...', views: 150_000, platform: 'YouTube' },
  { position: 13, clipper: '@clipador_ligeiro', videoUrl: 'tiktok.com/...', views: 120_000, platform: 'TikTok' },
  { position: 14, clipper: '@cortes_do_dia', videoUrl: 'instagram.com/...', views: 95_000, platform: 'Instagram' },
  { position: 15, clipper: '@editor_noturno', videoUrl: 'tiktok.com/...', views: 85_000, platform: 'TikTok' },
]

let dailyTotalPaid = 0

dailyTop15.forEach((winner) => {
  const prize = calculateDailyPrize(winner.position, DAILY_PRIZE_TABLE)
  dailyTotalPaid += prize
  
  const hasBonus = qualifiesForMilestoneBonus(winner.views, BONUS_MILESTONE)
  const bonusPrize = hasBonus ? BONUS_AMOUNT : 0
  const totalPrize = prize + bonusPrize
  
  console.log(
    `${winner.position}º - ${winner.clipper.padEnd(20)} | ` +
    `${formatViews(winner.views).padStart(8)} | ` +
    `${formatPrize(prize).padStart(10)}` +
    (hasBonus ? ` + ${formatPrize(bonusPrize)} BÔNUS 1M+ 🎉` : '')
  )
})

console.log()
console.log(`💰 Total pago no dia: ${formatPrize(dailyTotalPaid)}`)
console.log(`📊 Budget restante do mês (dia 15): ${formatPrize(30000 - (dailyTotalPaid * 15))}`)
console.log()
console.log('━'.repeat(80))
console.log()

// ============================================================================
// EXEMPLO 2: CÁLCULO DE PRÊMIO MENSAL
// ============================================================================

console.log('🏆 EXEMPLO 2: Premiação Mensal - Novembro 2025\n')

interface MonthlyWinner {
  position: number
  clipper: string
  totalViews: number
  postsCount: number
  videosOver100k: number
  videosOver500k: number
  bestVideo: number
}

const monthlyTop10: MonthlyWinner[] = [
  { position: 1, clipper: '@clipador_top', totalViews: 8_500_000, postsCount: 45, videosOver100k: 28, videosOver500k: 12, bestVideo: 1_250_000 },
  { position: 2, clipper: '@viral_sempre', totalViews: 7_200_000, postsCount: 38, videosOver100k: 22, videosOver500k: 9, bestVideo: 980_000 },
  { position: 3, clipper: '@editor_pro', totalViews: 6_100_000, postsCount: 42, videosOver100k: 19, videosOver500k: 7, bestVideo: 850_000 },
  { position: 4, clipper: '@melhor_editor', totalViews: 5_400_000, postsCount: 35, videosOver100k: 16, videosOver500k: 5, bestVideo: 890_000 },
  { position: 5, clipper: '@cortes_do_dia', totalViews: 4_800_000, postsCount: 40, videosOver100k: 14, videosOver500k: 4, bestVideo: 720_000 },
  { position: 6, clipper: '@clipfy_master', totalViews: 4_200_000, postsCount: 32, videosOver100k: 12, videosOver500k: 3, bestVideo: 680_000 },
  { position: 7, clipper: '@editor_rapido', totalViews: 3_800_000, postsCount: 36, videosOver100k: 10, videosOver500k: 2, bestVideo: 520_000 },
  { position: 8, clipper: '@cortes_incriveis', totalViews: 3_400_000, postsCount: 30, videosOver100k: 9, videosOver500k: 2, bestVideo: 480_000 },
  { position: 9, clipper: '@viral_videos', totalViews: 3_100_000, postsCount: 28, videosOver100k: 7, videosOver500k: 1, bestVideo: 450_000 },
  { position: 10, clipper: '@editor_noturno', totalViews: 2_800_000, postsCount: 25, videosOver100k: 6, videosOver500k: 1, bestVideo: 420_000 },
]

let monthlyTotalPaid = 0

console.log('Pos | Clipador              | Total Views | Posts | +100k | +500k | Prêmio')
console.log('━'.repeat(80))

monthlyTop10.forEach((winner) => {
  const prize = calculateMonthlyPrize(winner.position, MONTHLY_PRIZE_TABLE)
  monthlyTotalPaid += prize
  
  console.log(
    `${winner.position.toString().padStart(2)}º | ` +
    `${winner.clipper.padEnd(20)} | ` +
    `${formatViews(winner.totalViews).padStart(10)} | ` +
    `${winner.postsCount.toString().padStart(5)} | ` +
    `${winner.videosOver100k.toString().padStart(5)} | ` +
    `${winner.videosOver500k.toString().padStart(5)} | ` +
    `${formatPrize(prize)}`
  )
})

console.log()
console.log(`💰 Total pago no mês: ${formatPrize(monthlyTotalPaid)}`)
console.log()
console.log('━'.repeat(80))
console.log()

// ============================================================================
// RESUMO FINANCEIRO TOTAL
// ============================================================================

console.log('💎 RESUMO FINANCEIRO - COMPETIÇÃO COMPLETA (30 DIAS)\n')

const totalDaily = 1000 * 30 // R$ 1.000/dia × 30 dias
const totalMonthly = 20000 // R$ 20.000 mensal
const estimatedBonus = 6000 // Budget de bônus (estimativa)

console.log(`📅 Premiação Diária (30 dias):        ${formatPrize(totalDaily)}`)
console.log(`🏆 Premiação Mensal:                  ${formatPrize(totalMonthly)}`)
console.log(`🎁 Bônus por Marco (1M+ views):       ${formatPrize(estimatedBonus)} (teto)`)
console.log()
console.log(`━`.repeat(40))
console.log(`💰 TOTAL DA COMPETIÇÃO:               ${formatPrize(totalDaily + totalMonthly + estimatedBonus)}`)
console.log()
console.log('✨ Sistema 100% baseado em VIEWS')
console.log('🤖 Pronto para automação completa')
console.log()

