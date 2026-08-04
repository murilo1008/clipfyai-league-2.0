"use client"

import { jsPDF } from "jspdf"
import { toast } from "sonner"

// Logo Clipfy em base64 (PNG version)
const CLIPFY_LOGO_BASE64 = "data:image/png;base64,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"

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

// Cores oficiais Clipfy
const COLORS = {
  // Primary Cyan #14F7FF
  cyan: { r: 20, g: 247, b: 255 },
  // Secondary Green #37FF9F
  green: { r: 55, g: 255, b: 159 },
  // Backgrounds
  bgDark: { r: 10, g: 10, b: 10 },
  bgCard: { r: 24, g: 24, b: 27 },
  bgCardLight: { r: 39, g: 39, b: 42 },
  // Text
  white: { r: 250, g: 250, b: 250 },
  muted: { r: 113, g: 113, b: 122 },
  mutedLight: { r: 161, g: 161, b: 170 },
  // Accent colors
  blue: { r: 59, g: 130, b: 246 },
  red: { r: 239, g: 68, b: 68 },
  purple: { r: 139, g: 92, b: 246 },
  yellow: { r: 234, g: 179, b: 8 },
  orange: { r: 249, g: 115, b: 22 },
  pink: { r: 228, g: 64, b: 95 },
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "0"
  const n = Number(num) || 0
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(".", ",") + "M"
  } else if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(".", ",") + "K"
  }
  return n.toLocaleString("pt-BR")
}

const formatDate = (date: Date | string): string => {
  const d = new Date(date)
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d)
}

const formatDateShort = (date: Date | string): string => {
  const d = new Date(date)
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(d)
}

const getPlatformColor = (platform: string) => {
  switch (platform) {
    case "INSTAGRAM": return COLORS.pink
    case "TIKTOK": return COLORS.cyan
    case "YOUTUBE": return COLORS.red
    case "KWAI": return COLORS.orange
    case "FACEBOOK": return COLORS.blue
    default: return COLORS.cyan
  }
}

const getPlatformUrl = (platform: string, username: string): string => {
  const cleanUsername = username.replace(/^@/, "")
  switch (platform) {
    case "INSTAGRAM": return `https://instagram.com/${cleanUsername}`
    case "TIKTOK": return `https://tiktok.com/@${cleanUsername}`
    case "YOUTUBE": return `https://youtube.com/@${cleanUsername}`
    case "KWAI": return `https://kwai.com/@${cleanUsername}`
    case "FACEBOOK": return `https://facebook.com/${cleanUsername}`
    default: return `https://instagram.com/${cleanUsername}`
  }
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "ACTIVE": return "ATIVA"
    case "COMPLETED": return "CONCLUIDA"
    case "SCHEDULED": return "AGENDADA"
    case "PAUSED": return "PAUSADA"
    case "ARCHIVED": return "ARQUIVADA"
    case "DRAFT": return "RASCUNHO"
    default: return status
  }
}

export async function generateCompetitionReport(data: CompetitionData) {
  if (!data) {
    toast.error("Dados da competicao nao disponiveis")
    return
  }

  toast.loading("Gerando relatorio PDF...", { id: "pdf-generation" })

  try {
    const { campaign, analytics, ranking, topPosts } = data

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = 210
    const pageHeight = 297
    const margin = 10
    const contentWidth = pageWidth - margin * 2
    let y = 0

    // Helper functions
    const setColor = (color: { r: number; g: number; b: number }) => {
      pdf.setTextColor(color.r, color.g, color.b)
    }

    const setFill = (color: { r: number; g: number; b: number }) => {
      pdf.setFillColor(color.r, color.g, color.b)
    }

    const setDraw = (color: { r: number; g: number; b: number }) => {
      pdf.setDrawColor(color.r, color.g, color.b)
    }

    const newPage = () => {
      pdf.addPage()
      setFill(COLORS.bgDark)
      pdf.rect(0, 0, pageWidth, pageHeight, "F")
      y = margin + 5
    }

    const checkPage = (height: number) => {
      if (y + height > pageHeight - margin) {
        newPage()
        return true
      }
      return false
    }

    // Draw gradient rectangle (simulated with color)
    const drawGradientRect = (x: number, yPos: number, w: number, h: number, colorStart: { r: number; g: number; b: number }, colorEnd: { r: number; g: number; b: number }) => {
      // Simulate gradient with start color
      setFill(colorStart)
      pdf.roundedRect(x, yPos, w, h, 2, 2, "F")
    }

    // ========== PAGE 1: COVER ==========
    setFill(COLORS.bgDark)
    pdf.rect(0, 0, pageWidth, pageHeight, "F")

    // Top decorative bar
    setFill(COLORS.cyan)
    pdf.rect(0, 0, pageWidth / 2, 3, "F")
    setFill(COLORS.green)
    pdf.rect(pageWidth / 2, 0, pageWidth / 2, 3, "F")

    // Logo text "Clipfy League"
    y = 50
    pdf.setFontSize(36)
    pdf.setFont("helvetica", "bold")
    
    // "Clip" in white
    const clipText = "Clip"
    const clipWidth = pdf.getTextWidth(clipText)
    const fyText = "fy"
    const fyWidth = pdf.getTextWidth(fyText)
    const spaceWidth = pdf.getTextWidth(" ")
    const leagueText = "League"
    const leagueWidth = pdf.getTextWidth(leagueText)
    
    const totalWidth = clipWidth + fyWidth + spaceWidth + leagueWidth
    const startX = pageWidth / 2 - totalWidth / 2
    
    // Draw "Clip" in white
    setColor(COLORS.white)
    pdf.text(clipText, startX, y)
    
    // Draw "fy" in cyan
    pdf.setTextColor(20, 247, 255)
    pdf.text(fyText, startX + clipWidth, y)
    
    // Draw " League" in green
    pdf.setTextColor(55, 255, 159)
    pdf.text(" " + leagueText, startX + clipWidth + fyWidth, y)

    // Decorative line
    y += 8
    setFill(COLORS.bgCardLight)
    pdf.rect(pageWidth / 2 - 30, y, 60, 0.5, "F")

    // Competition name
    y += 20
    pdf.setFontSize(28)
    pdf.setFont("helvetica", "bold")
    setColor(COLORS.white)
    const nameLines = pdf.splitTextToSize(campaign.name.toUpperCase(), contentWidth - 20)
    nameLines.forEach((line: string) => {
      pdf.text(line, pageWidth / 2, y, { align: "center" })
      y += 12
    })

    // Status badge
    y += 5
    const statusText = getStatusLabel(campaign.status)
    const statusWidth = pdf.getTextWidth(statusText) + 16
    drawGradientRect(pageWidth / 2 - statusWidth / 2, y, statusWidth, 10, COLORS.cyan, COLORS.green)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(10, 10, 10)
    pdf.text(statusText, pageWidth / 2, y + 7, { align: "center" })

    // Period
    y += 20
    pdf.setFontSize(12)
    setColor(COLORS.mutedLight)
    pdf.setFont("helvetica", "normal")
    
    // Data do relatório (data atual)
    const now = new Date()
    const months = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ]
    const day = now.getDate().toString().padStart(2, "0")
    const month = months[now.getMonth()]
    const year = now.getFullYear()
    const reportDate = `${day} de ${month} de ${year}`
    
    pdf.text("Relatório gerado em:", pageWidth / 2, y, { align: "center" })
    y += 8
    pdf.setFontSize(11)
    setColor(COLORS.white)
    pdf.setFont("helvetica", "bold")
    pdf.text(reportDate, pageWidth / 2, y, { align: "center" })

    // Platforms - centered with proper spacing
    y += 15
    const platformBadgeWidth = 28
    const platformSpacing = 3
    const totalPlatformsWidth = campaign.platforms.length * platformBadgeWidth + (campaign.platforms.length - 1) * platformSpacing
    let platformX = pageWidth / 2 - totalPlatformsWidth / 2
    
    campaign.platforms.forEach((platform, idx) => {
      const pColor = getPlatformColor(platform)
      setFill(pColor)
      pdf.roundedRect(platformX, y, platformBadgeWidth, 8, 2, 2, "F")
      pdf.setFontSize(7)
      pdf.setTextColor(10, 10, 10)
      pdf.setFont("helvetica", "bold")
      pdf.text(platform, platformX + platformBadgeWidth / 2, y + 5.5, { align: "center" })
      platformX += platformBadgeWidth + platformSpacing
    })

    // Big numbers section
    y += 30

    // Views highlight
    setFill(COLORS.bgCard)
    pdf.roundedRect(margin + 10, y, contentWidth - 20, 40, 4, 4, "F")
    
    pdf.setFontSize(10)
    setColor(COLORS.mutedLight)
    pdf.setFont("helvetica", "normal")
    pdf.text("TOTAL DE VIEWS", pageWidth / 2, y + 10, { align: "center" })
    
    pdf.setFontSize(42)
    pdf.setFont("helvetica", "bold")
    setColor(COLORS.cyan)
    pdf.text(formatNumber(analytics.totalViews), pageWidth / 2, y + 32, { align: "center" })

    y += 50

    // Three cards row
    const cardW = (contentWidth - 30) / 3
    const cards = [
      { label: "VIDEOS", value: formatNumber(analytics.totalPosts), color: COLORS.purple },
      { label: "ENGAJAMENTO", value: `${analytics.engagementRate.toFixed(1)}%`, color: COLORS.green },
      { label: "PARTICIPANTES", value: formatNumber(analytics.totalParticipants), color: COLORS.blue },
    ]

    cards.forEach((card, i) => {
      const cardX = margin + 10 + i * (cardW + 5)
      setFill(COLORS.bgCard)
      pdf.roundedRect(cardX, y, cardW, 30, 3, 3, "F")
      
      // Top accent line
      setFill(card.color)
      pdf.roundedRect(cardX, y, cardW, 2, 1, 1, "F")
      
      pdf.setFontSize(8)
      setColor(COLORS.mutedLight)
      pdf.setFont("helvetica", "normal")
      pdf.text(card.label, cardX + cardW / 2, y + 10, { align: "center" })
      
      pdf.setFontSize(18)
      pdf.setFont("helvetica", "bold")
      setColor(card.color)
      pdf.text(card.value, cardX + cardW / 2, y + 23, { align: "center" })
    })

    // Footer
    y = pageHeight - 20
    setFill(COLORS.bgCardLight)
    pdf.rect(0, y - 5, pageWidth, 25, "F")
    
    pdf.setFontSize(8)
    setColor(COLORS.muted)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Relatorio gerado em ${new Date().toLocaleDateString("pt-BR")} as ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, y + 3, { align: "center" })
    
    pdf.setFontSize(7)
    pdf.text("clipfy.com.br", pageWidth / 2, y + 10, { align: "center" })

    // ========== PAGE 2: METRICS ==========
    newPage()

    // Header
    pdf.setFontSize(10)
    setColor(COLORS.cyan)
    pdf.setFont("helvetica", "bold")
    pdf.text("CLIPFY LEAGUE", margin, y)
    
    setColor(COLORS.muted)
    pdf.setFont("helvetica", "normal")
    pdf.text(campaign.name, pageWidth - margin, y, { align: "right" })

    y += 3
    setFill(COLORS.bgCardLight)
    pdf.rect(margin, y, contentWidth, 0.3, "F")

    // Section: Metricas Detalhadas
    y += 15
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    setColor(COLORS.white)
    pdf.text("Metricas Detalhadas", margin, y)

    y += 3
    setFill(COLORS.cyan)
    pdf.rect(margin, y, 40, 1, "F")

    y += 12

    // Metrics grid (2x2)
    const metricCardW = (contentWidth - 8) / 2
    const metricCardH = 35
    const detailedMetrics = [
      { icon: "VIEWS", label: "Views da Campanha", value: formatNumber(analytics.totalViews), sub: `Media: ${formatNumber(analytics.avgViews)} por video`, color: COLORS.blue },
      { icon: "CURTIDAS", label: "Total de Curtidas", value: formatNumber(analytics.totalLikes), sub: `${((analytics.totalLikes / analytics.totalViews) * 100 || 0).toFixed(2)}% dos views`, color: COLORS.red },
      { icon: "COMENTARIOS", label: "Comentarios", value: formatNumber(analytics.totalComments), sub: `${((analytics.totalComments / analytics.totalViews) * 100 || 0).toFixed(2)}% dos views`, color: COLORS.cyan },
      { icon: "COMPARTILHAMENTOS", label: "Compartilhamentos", value: formatNumber(analytics.totalShares), sub: `${((analytics.totalShares / analytics.totalViews) * 100 || 0).toFixed(2)}% dos views`, color: COLORS.purple },
    ]

    detailedMetrics.forEach((metric, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const cardX = margin + col * (metricCardW + 8)
      const cardY = y + row * (metricCardH + 8)

      // Card background
      setFill(COLORS.bgCard)
      pdf.roundedRect(cardX, cardY, metricCardW, metricCardH, 3, 3, "F")

      // Left accent
      setFill(metric.color)
      pdf.roundedRect(cardX, cardY, 3, metricCardH, 1.5, 1.5, "F")

      // Icon/Label
      pdf.setFontSize(7)
      setColor(COLORS.mutedLight)
      pdf.setFont("helvetica", "bold")
      pdf.text(metric.icon, cardX + 8, cardY + 8)

      // Value
      pdf.setFontSize(22)
      pdf.setFont("helvetica", "bold")
      setColor(metric.color)
      pdf.text(metric.value, cardX + 8, cardY + 22)

      // Sub
      pdf.setFontSize(8)
      setColor(COLORS.muted)
      pdf.setFont("helvetica", "normal")
      pdf.text(metric.sub, cardX + 8, cardY + 30)
    })

    y += (metricCardH + 8) * 2 + 15

    // Section: Distribuicao por Plataforma
    if (analytics.platformStats && analytics.platformStats.length > 0) {
      checkPage(80)

      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      setColor(COLORS.white)
      pdf.text("Distribuicao por Plataforma", margin, y)

      y += 3
      setFill(COLORS.green)
      pdf.rect(margin, y, 50, 1, "F")

      y += 12

      // Platform bars
      const maxViews = Math.max(...analytics.platformStats.map(p => p.views))
      
      analytics.platformStats.forEach((stat) => {
        checkPage(18)

        const pColor = getPlatformColor(stat.platform)
        const barWidth = (stat.views / maxViews) * (contentWidth - 50)

        // Background bar
        setFill(COLORS.bgCard)
        pdf.roundedRect(margin, y, contentWidth, 14, 2, 2, "F")

        // Progress bar
        setFill(pColor)
        pdf.roundedRect(margin, y, Math.max(barWidth, 20), 14, 2, 2, "F")

        // Platform name
        pdf.setFontSize(9)
        pdf.setTextColor(10, 10, 10)
        pdf.setFont("helvetica", "bold")
        pdf.text(stat.platform, margin + 5, y + 9)

        // Stats on the right
        setColor(COLORS.white)
        pdf.setFont("helvetica", "normal")
        pdf.text(`${formatNumber(stat.views)} views  |  ${formatNumber(stat.likes)} curtidas  |  ${stat.posts} videos`, pageWidth - margin - 5, y + 9, { align: "right" })

        y += 18
      })
    }

    // ========== PAGE 3: RANKING ==========
    if (ranking && ranking.length > 0) {
      newPage()

      // Header
      pdf.setFontSize(10)
      setColor(COLORS.cyan)
      pdf.setFont("helvetica", "bold")
      pdf.text("CLIPFY LEAGUE", margin, y)
      
      setColor(COLORS.muted)
      pdf.setFont("helvetica", "normal")
      pdf.text(campaign.name, pageWidth - margin, y, { align: "right" })

      y += 3
      setFill(COLORS.bgCardLight)
      pdf.rect(margin, y, contentWidth, 0.3, "F")

      y += 15

      // Section title
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      setColor(COLORS.white)
      pdf.text("Top Contas", margin, y)

      y += 3
      setFill(COLORS.yellow)
      pdf.rect(margin, y, 30, 1, "F")

      pdf.setFontSize(9)
      setColor(COLORS.mutedLight)
      pdf.setFont("helvetica", "normal")
      pdf.text("Ranking das contas com melhor desempenho", margin, y + 8)

      y += 18

      // Ranking list
      ranking.slice(0, 15).forEach((item, index) => {
        if (checkPage(22)) {
          // Re-add header on new page
          pdf.setFontSize(10)
          setColor(COLORS.cyan)
          pdf.setFont("helvetica", "bold")
          pdf.text("CLIPFY LEAGUE - Top Contas (continuacao)", margin, y)
          y += 10
        }

        // Row background with gradient effect based on position
        if (index === 0) {
          setFill({ r: 234, g: 179, b: 8 }) // Yellow for 1st
          pdf.setDrawColor(234, 179, 8)
        } else if (index === 1) {
          setFill({ r: 148, g: 163, b: 184 }) // Silver for 2nd
          pdf.setDrawColor(148, 163, 184)
        } else if (index === 2) {
          setFill({ r: 217, g: 119, b: 6 }) // Bronze for 3rd
          pdf.setDrawColor(217, 119, 6)
        } else {
          setFill(COLORS.bgCard)
          pdf.setDrawColor(50, 50, 60)
        }
        
        pdf.roundedRect(margin, y, contentWidth, 18, 3, 3, index < 3 ? "FD" : "F")

        // Position circle
        let posColor = COLORS.bgCardLight
        if (index === 0) posColor = { r: 250, g: 204, b: 21 }
        else if (index === 1) posColor = { r: 203, g: 213, b: 225 }
        else if (index === 2) posColor = { r: 251, g: 146, b: 60 }

        setFill(posColor)
        pdf.circle(margin + 12, y + 9, 7, "F")
        
        pdf.setFontSize(11)
        pdf.setTextColor(10, 10, 10)
        pdf.setFont("helvetica", "bold")
        pdf.text(`${index + 1}`, margin + 12, y + 11.5, { align: "center" })

        // Username with @ - LARGE and prominent
        if (index < 3) {
          pdf.setTextColor(10, 10, 10)
        } else {
          setColor(COLORS.cyan)
        }
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        
        // Get username - use artisticName or username
        const rawUsername = String(item.username || item.artisticName || "usuario")
        const cleanUsername = rawUsername.startsWith("@") ? rawUsername.substring(1) : rawUsername
        const displayName = cleanUsername.length > 14 ? cleanUsername.substring(0, 12) + "..." : cleanUsername
        const usernameWithAt = `@${displayName}`
        pdf.text(usernameWithAt, margin + 24, y + 11)

        // VER PERFIL button with link
        if (index < 3) {
          setFill({ r: 30, g: 30, b: 30 })
        } else {
          setFill(COLORS.green)
        }
        pdf.roundedRect(margin + 75, y + 5, 28, 8, 2, 2, "F")
        pdf.setFontSize(6)
        if (index < 3) {
          pdf.setTextColor(255, 255, 255)
        } else {
          pdf.setTextColor(10, 10, 10)
        }
        pdf.setFont("helvetica", "bold")
        pdf.text("VER PERFIL", margin + 89, y + 10.5, { align: "center" })
        
        // Create profile URL - use Instagram as default for aggregated ranking
        const platform = item.platform || "INSTAGRAM"
        const profileUrl = getPlatformUrl(platform, cleanUsername)
        pdf.link(margin + 75, y + 5, 28, 8, { url: profileUrl })

        // Stats - adjust colors for top 3
        const statsTextColor = index < 3 ? { r: 30, g: 30, b: 30 } : COLORS.blue
        const statsLabelColor = index < 3 ? { r: 60, g: 60, b: 60 } : COLORS.muted

        // Views
        if (index < 3) {
          pdf.setTextColor(30, 30, 30)
        } else {
          setColor(COLORS.blue)
        }
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bold")
        pdf.text(formatNumber(item.totalViews), margin + 110, y + 8)
        if (index < 3) {
          pdf.setTextColor(60, 60, 60)
        } else {
          setColor(COLORS.muted)
        }
        pdf.setFontSize(6)
        pdf.setFont("helvetica", "normal")
        pdf.text("views", margin + 110, y + 14)

        // Likes
        if (index < 3) {
          pdf.setTextColor(30, 30, 30)
        } else {
          setColor(COLORS.red)
        }
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bold")
        pdf.text(formatNumber(item.totalLikes), margin + 140, y + 8)
        if (index < 3) {
          pdf.setTextColor(60, 60, 60)
        } else {
          setColor(COLORS.muted)
        }
        pdf.setFontSize(6)
        pdf.setFont("helvetica", "normal")
        pdf.text("curtidas", margin + 140, y + 14)

        // Videos count
        if (index < 3) {
          pdf.setTextColor(30, 30, 30)
        } else {
          setColor(COLORS.purple)
        }
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bold")
        pdf.text(`${item.totalPosts || 0}`, margin + 175, y + 8)
        if (index < 3) {
          pdf.setTextColor(60, 60, 60)
        } else {
          setColor(COLORS.muted)
        }
        pdf.setFontSize(6)
        pdf.setFont("helvetica", "normal")
        pdf.text("videos", margin + 175, y + 14)

        y += 20
      })
    }

    // ========== PAGE 4: TOP VIDEOS ==========
    if (topPosts && topPosts.length > 0) {
      newPage()

      // Header
      pdf.setFontSize(10)
      setColor(COLORS.cyan)
      pdf.setFont("helvetica", "bold")
      pdf.text("CLIPFY LEAGUE", margin, y)
      
      setColor(COLORS.muted)
      pdf.setFont("helvetica", "normal")
      pdf.text(campaign.name, pageWidth - margin, y, { align: "right" })

      y += 3
      setFill(COLORS.bgCardLight)
      pdf.rect(margin, y, contentWidth, 0.3, "F")

      y += 15

      // Section title
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      setColor(COLORS.white)
      pdf.text("Top Videos Mais Virais", margin, y)

      y += 3
      setFill(COLORS.orange)
      pdf.rect(margin, y, 45, 1, "F")

      pdf.setFontSize(9)
      setColor(COLORS.mutedLight)
      pdf.setFont("helvetica", "normal")
      pdf.text("Videos com melhor desempenho na competicao", margin, y + 8)

      y += 18

      // Videos list
      topPosts.slice(0, 10).forEach((post, index) => {
        if (checkPage(20)) {
          pdf.setFontSize(10)
          setColor(COLORS.cyan)
          pdf.setFont("helvetica", "bold")
          pdf.text("CLIPFY LEAGUE - Top Videos (continuacao)", margin, y)
          y += 10
        }

        // Row background
        setFill(COLORS.bgCard)
        pdf.roundedRect(margin, y, contentWidth, 18, 2, 2, "F")

        // Position badge
        setFill(COLORS.yellow)
        pdf.roundedRect(margin + 3, y + 4, 14, 10, 2, 2, "F")
        pdf.setFontSize(10)
        pdf.setTextColor(10, 10, 10)
        pdf.setFont("helvetica", "bold")
        pdf.text(`#${index + 1}`, margin + 10, y + 11, { align: "center" })

        // Username with @ - ensure @ is always shown
        const rawPostUsername = String(post.username || "usuario")
        const cleanPostUsername = rawPostUsername.startsWith("@") ? rawPostUsername.substring(1) : rawPostUsername
        setColor(COLORS.cyan)
        pdf.setFontSize(10)
        pdf.setFont("helvetica", "bold")
        const displayPostName = cleanPostUsername.length > 12 ? cleanPostUsername.substring(0, 10) + "..." : cleanPostUsername
        const postUsernameWithAt = `@${displayPostName}`
        pdf.text(postUsernameWithAt, margin + 22, y + 7)

        // Platform badge
        const pColor = getPlatformColor(post.platform)
        setFill(pColor)
        pdf.roundedRect(margin + 22, y + 10, 18, 5, 1, 1, "F")
        pdf.setFontSize(6)
        pdf.setTextColor(10, 10, 10)
        pdf.setFont("helvetica", "bold")
        pdf.text(post.platform, margin + 31, y + 13.5, { align: "center" })

        // Stats with proper values
        const viewsVal = Number(post.views) || 0
        const likesVal = Number(post.likes) || 0
        const commentsVal = Number(post.comments) || 0
        const sharesVal = Number(post.shares) || 0

        // Views
        setColor(COLORS.blue)
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text(formatNumber(viewsVal), margin + 55, y + 8)
        setColor(COLORS.muted)
        pdf.setFontSize(5)
        pdf.setFont("helvetica", "normal")
        pdf.text("views", margin + 55, y + 13)

        // Likes
        setColor(COLORS.red)
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text(formatNumber(likesVal), margin + 80, y + 8)
        setColor(COLORS.muted)
        pdf.setFontSize(5)
        pdf.setFont("helvetica", "normal")
        pdf.text("curtidas", margin + 80, y + 13)

        // Comments
        setColor(COLORS.cyan)
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text(formatNumber(commentsVal), margin + 105, y + 8)
        setColor(COLORS.muted)
        pdf.setFontSize(5)
        pdf.setFont("helvetica", "normal")
        pdf.text("comentarios", margin + 105, y + 13)

        // Shares
        setColor(COLORS.purple)
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text(formatNumber(sharesVal), margin + 135, y + 8)
        setColor(COLORS.muted)
        pdf.setFontSize(5)
        pdf.setFont("helvetica", "normal")
        pdf.text("compartilh.", margin + 135, y + 13)

        // Link button
        if (post.url) {
          setFill(COLORS.green)
          pdf.roundedRect(margin + 165, y + 5, 22, 8, 2, 2, "F")
          pdf.setFontSize(6)
          pdf.setTextColor(10, 10, 10)
          pdf.setFont("helvetica", "bold")
          pdf.text("VER VIDEO", margin + 176, y + 10.5, { align: "center" })
          pdf.link(margin + 165, y + 5, 22, 8, { url: post.url })
        }

        y += 20
      })
    }

    // ========== PAGE 5: HASHTAGS ==========
    if (campaign.requiredHashtags && campaign.requiredHashtags.length > 0) {
      checkPage(60)

      if (y > 50) {
        y += 20
      }

      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      setColor(COLORS.white)
      pdf.text("Hashtags da Competicao", margin, y)

      y += 3
      setFill(COLORS.cyan)
      pdf.rect(margin, y, 50, 1, "F")

      pdf.setFontSize(9)
      setColor(COLORS.mutedLight)
      pdf.setFont("helvetica", "normal")
      pdf.text("Hashtags obrigatorias que os participantes devem usar", margin, y + 8)

      y += 18

      // Hashtags grid
      let hashX = margin
      const hashtagRowHeight = 12

      campaign.requiredHashtags.forEach((hashtag) => {
        const tagText = `#${hashtag}`
        pdf.setFontSize(10)
        const tagWidth = pdf.getTextWidth(tagText) + 12

        if (hashX + tagWidth > pageWidth - margin) {
          hashX = margin
          y += hashtagRowHeight
        }

        // Gradient badge
        setFill(COLORS.cyan)
        pdf.roundedRect(hashX, y, tagWidth, 9, 2, 2, "F")
        
        pdf.setTextColor(10, 10, 10)
        pdf.setFont("helvetica", "bold")
        pdf.text(tagText, hashX + 6, y + 6.5)

        hashX += tagWidth + 5
      })
    }

    // ========== FINAL FOOTER ==========
    // Add to last page
    y = pageHeight - 25
    
    setFill(COLORS.bgCardLight)
    pdf.rect(0, y - 5, pageWidth, 30, "F")

    // Decorative top line
    setFill(COLORS.cyan)
    pdf.rect(0, y - 5, pageWidth / 2, 1, "F")
    setFill(COLORS.green)
    pdf.rect(pageWidth / 2, y - 5, pageWidth / 2, 1, "F")

    pdf.setFontSize(12)
    setColor(COLORS.cyan)
    pdf.setFont("helvetica", "bold")
    pdf.text("Clipfy", pageWidth / 2 - 10, y + 5)
    setColor(COLORS.green)
    pdf.text("League", pageWidth / 2 + 10, y + 5)

    pdf.setFontSize(8)
    setColor(COLORS.muted)
    pdf.setFont("helvetica", "normal")
    pdf.text("Relatorio gerado automaticamente  |  clipfy.com.br", pageWidth / 2, y + 12, { align: "center" })
    pdf.text(`© ${new Date().getFullYear()} Clipfy. Todos os direitos reservados.`, pageWidth / 2, y + 17, { align: "center" })

    // Save PDF
    const fileName = `relatorio-${campaign.slug}-${new Date().toISOString().split("T")[0]}.pdf`
    pdf.save(fileName)

    toast.success("Relatorio PDF gerado com sucesso!", { id: "pdf-generation" })
  } catch (error) {
    console.error("Erro ao gerar PDF:", error)
    toast.error("Erro ao gerar PDF. Tente novamente.", { id: "pdf-generation" })
  }
}
