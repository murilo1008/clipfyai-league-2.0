"use client"

import * as XLSX from "xlsx"
import { toast } from "sonner"

interface CompetitionData {
  campaign: {
    id: string
    name: string
    slug: string
    description: string | null
    status: string
    coverImageUrl: string | null
    startDate: Date
    endDate: Date
    platforms: string[]
    requiredHashtags: string[]
    requiredMentions: string[]
    prizePool: number | string | null
    rankingMetricType: string | null
  }
  analytics: {
    totalViews: number
    totalLikes: number
    totalComments: number
    totalShares: number
    totalPosts: number
    totalParticipants: number
    avgViews: number
    engagementRate: number
    recentViews: number
    recentPosts: number
    dailyStats: { date: string; views: number; posts: number }[]
    platformStats: {
      platform: string
      views: number
      likes: number
      comments: number
      shares: number
      posts: number
    }[]
  }
  ranking: {
    userId: string
    position: number
    previousPosition: number | null
    username: string
    platform: string
    totalViews: number
    totalLikes: number
    totalComments: number
    totalShares: number
    totalPosts: number
    engagementRate: number
    rankingScore?: number
    profileImageUrl?: string | null
    artisticName?: string | null
  }[]
  topPosts: {
    id: string
    url: string
    thumbnailUrl: string | null
    platform: string
    username: string
    views: number
    likes: number
    comments: number
    shares: number
    postedAt: Date
  }[]
}

const formatNumber = (num: number | null | undefined): number => {
  if (num === null || num === undefined) return 0
  return Number(num) || 0
}

const formatDate = (date: Date | string): string => {
  const d = new Date(date)
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "ACTIVE": return "Ativa"
    case "COMPLETED": return "Concluída"
    case "SCHEDULED": return "Agendada"
    case "PAUSED": return "Pausada"
    case "ARCHIVED": return "Arquivada"
    case "DRAFT": return "Rascunho"
    default: return status
  }
}

export async function generateCompetitionExcel(data: CompetitionData) {
  if (!data) {
    toast.error("Dados da competição não disponíveis")
    return
  }

  toast.loading("Gerando planilha Excel...", { id: "excel-generation" })

  try {
    const { campaign, analytics, ranking, topPosts } = data

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // ========== ABA 1: RESUMO GERAL ==========
    const resumoData = [
      ["CLIPFY LEAGUE - RELATÓRIO DA COMPETIÇÃO"],
      [""],
      ["Gerado em:", new Date().toLocaleString("pt-BR")],
      [""],
      ["INFORMAÇÕES DA COMPETIÇÃO"],
      ["Nome:", campaign.name],
      ["Status:", getStatusLabel(campaign.status)],
      ["Descrição:", campaign.description || "-"],
      ["Período:", `${formatDate(campaign.startDate)} até ${formatDate(campaign.endDate)}`],
      ["Plataformas:", campaign.platforms.join(", ")],
      ["Hashtags:", campaign.requiredHashtags.map(h => `#${h}`).join(" ")],
      [""],
      ["MÉTRICAS GLOBAIS"],
      ["Total de Views:", formatNumber(analytics.totalViews)],
      ["Total de Vídeos:", formatNumber(analytics.totalPosts)],
      ["Total de Participantes:", formatNumber(analytics.totalParticipants)],
      ["Taxa de Engajamento:", `${analytics.engagementRate.toFixed(2)}%`],
      ["Média de Views por Vídeo:", formatNumber(analytics.avgViews)],
      [""],
      ["MÉTRICAS DETALHADAS"],
      ["Total de Curtidas:", formatNumber(analytics.totalLikes)],
      ["Total de Comentários:", formatNumber(analytics.totalComments)],
      ["Total de Compartilhamentos:", formatNumber(analytics.totalShares)],
      ["Total de Interações:", formatNumber(analytics.totalLikes + analytics.totalComments + analytics.totalShares)],
      ["% Curtidas/Views:", `${((analytics.totalLikes / analytics.totalViews) * 100 || 0).toFixed(2)}%`],
      ["% Comentários/Views:", `${((analytics.totalComments / analytics.totalViews) * 100 || 0).toFixed(2)}%`],
      ["% Compartilhamentos/Views:", `${((analytics.totalShares / analytics.totalViews) * 100 || 0).toFixed(2)}%`],
    ]

    const resumoSheet = XLSX.utils.aoa_to_sheet(resumoData)
    
    // Ajustar largura das colunas
    resumoSheet["!cols"] = [
      { wch: 30 },
      { wch: 50 },
    ]

    XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo Geral")

    // ========== ABA 2: DISTRIBUIÇÃO POR PLATAFORMA ==========
    const platformHeader = [
      ["DISTRIBUIÇÃO POR PLATAFORMA"],
      [""],
      ["Plataforma", "Views", "Curtidas", "Comentários", "Compartilhamentos", "Vídeos", "% do Total"],
    ]

    const platformRows = analytics.platformStats.map(stat => [
      stat.platform,
      formatNumber(stat.views),
      formatNumber(stat.likes),
      formatNumber(stat.comments),
      formatNumber(stat.shares),
      formatNumber(stat.posts),
      `${((stat.views / analytics.totalViews) * 100 || 0).toFixed(2)}%`,
    ])

    const platformData = [...platformHeader, ...platformRows]
    const platformSheet = XLSX.utils.aoa_to_sheet(platformData)
    
    platformSheet["!cols"] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(workbook, platformSheet, "Por Plataforma")

    // ========== ABA 3: TOP CONTAS ==========
    const creatorsHeader = [
      ["TOP CONTAS - RANKING COMPLETO"],
      [""],
      ["Posição", "Username", "Plataforma", "Views", "Curtidas", "Comentários", "Compartilhamentos", "Vídeos", "Taxa de Engajamento", "Score"],
    ]

    const creatorsRows = ranking.map((item, index) => [
      index + 1,
      `@${item.username}`,
      item.platform,
      formatNumber(item.totalViews),
      formatNumber(item.totalLikes),
      formatNumber(item.totalComments),
      formatNumber(item.totalShares),
      formatNumber(item.totalPosts),
      `${(item.engagementRate || 0).toFixed(2)}%`,
      formatNumber(item.rankingScore),
    ])

    const creatorsData = [...creatorsHeader, ...creatorsRows]
    const creatorsSheet = XLSX.utils.aoa_to_sheet(creatorsData)
    
    creatorsSheet["!cols"] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 },
      { wch: 18 },
      { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(workbook, creatorsSheet, "Top Contas")

    // ========== ABA 4: TOP VÍDEOS ==========
    const postsHeader = [
      ["TOP VÍDEOS MAIS VIRAIS"],
      [""],
      ["Posição", "Username", "Plataforma", "Views", "Curtidas", "Comentários", "Compartilhamentos", "Data de Postagem", "URL"],
    ]

    const postsRows = topPosts.map((post, index) => [
      index + 1,
      `@${post.username}`,
      post.platform,
      formatNumber(post.views),
      formatNumber(post.likes),
      formatNumber(post.comments),
      formatNumber(post.shares),
      formatDate(post.postedAt),
      post.url,
    ])

    const postsData = [...postsHeader, ...postsRows]
    const postsSheet = XLSX.utils.aoa_to_sheet(postsData)
    
    postsSheet["!cols"] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 15 },
      { wch: 50 },
    ]

    XLSX.utils.book_append_sheet(workbook, postsSheet, "Top Vídeos")

    // ========== ABA 5: DADOS DIÁRIOS (se disponível) ==========
    if (analytics.dailyStats && analytics.dailyStats.length > 0) {
      const dailyHeader = [
        ["EVOLUÇÃO DIÁRIA"],
        [""],
        ["Data", "Views", "Vídeos Postados"],
      ]

      const dailyRows = analytics.dailyStats.map(stat => [
        stat.date,
        formatNumber(stat.views),
        formatNumber(stat.posts),
      ])

      const dailyData = [...dailyHeader, ...dailyRows]
      const dailySheet = XLSX.utils.aoa_to_sheet(dailyData)
      
      dailySheet["!cols"] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
      ]

      XLSX.utils.book_append_sheet(workbook, dailySheet, "Evolução Diária")
    }

    // ========== ABA 6: HASHTAGS ==========
    if (campaign.requiredHashtags && campaign.requiredHashtags.length > 0) {
      const hashtagsData = [
        ["HASHTAGS DA COMPETIÇÃO"],
        [""],
        ["Hashtag"],
        ...campaign.requiredHashtags.map(h => [`#${h}`]),
      ]

      const hashtagsSheet = XLSX.utils.aoa_to_sheet(hashtagsData)
      
      hashtagsSheet["!cols"] = [
        { wch: 30 },
      ]

      XLSX.utils.book_append_sheet(workbook, hashtagsSheet, "Hashtags")
    }

    // Generate file and download
    const fileName = `relatorio-${campaign.slug}-${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)

    toast.success("Planilha Excel gerada com sucesso!", { id: "excel-generation" })
  } catch (error) {
    console.error("Erro ao gerar planilha:", error)
    toast.error("Erro ao gerar planilha. Tente novamente.", { id: "excel-generation" })
  }
}

