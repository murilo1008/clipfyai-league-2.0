import { createTRPCRouter, adminProcedure } from "../trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import OpenAI from "openai"
import { env } from "@/env"
import { calculateEngagementRate } from "@/lib/ranking-helpers"

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

type DB = Parameters<
  Parameters<typeof adminProcedure.mutation>[0]
>[0]["ctx"]["db"]

function serialize(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? Number(v) : v)),
  )
}

function stripSensitiveClipper(profile: Record<string, unknown>) {
  const { cpf, pixKey, ...safe } = profile
  return safe
}

const SENSITIVE_FIELDS = new Set([
  "cpf", "pixKey", "accessToken", "refreshToken", "kiwifyClientId",
  "kiwifySecretKey", "kiwifyAccountId", "secret", "ipAddress",
  "ipHash", "withdrawalDetails",
])

function stripSensitiveDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(stripSensitiveDeep)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) continue
    result[key] = stripSensitiveDeep(value)
  }
  return result
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA REFERENCE — Compacted for AI context
// ═══════════════════════════════════════════════════════════════════════════════

const DB_SCHEMA_REFERENCE = `
═══ PRISMA MODELS (nomes para usar em executeDynamicQuery) ═══

user { id mod, email, name, imageUrl, onboardingCompleted, role(ADMIN|ORGANIZER_ADMIN|CLIENT|CLIPPER), referralSlug, subscriptionStatus(ACTIVE|CANCELLED|EXPIRED|TRIAL|NONE), subscriptionTier(NONE|PRO|ULTRA), hasStore, hasKiwifyStore, hasClipperManual, clipperManualPurchaseDate, paymentPlatform, lastPurchaseDate, createdAt, updatedAt }
  → clipperProfile, clientProfile, organizations, createdCampaigns, clientCampaigns, auditLogs, notifications, blogPosts, blogComments, lessonProgress, lessonLikes

organization { id, name, slug(unique), description, logoUrl, website, country, timezone, isActive, quotaMonthlyIngest, quotaActiveCampaigns, quotaCreatorsPerCampaign, createdAt }
  → members, campaigns, webhookEndpoints, quotaUsage

organizationMember { id, userId, organizationId, role(OWNER|ADMIN|MEMBER|VIEWER), permissions:Json, invitedBy, joinedAt }
  → user, organization

campaign { id, organizationId, creatorId, clientId, name, slug(unique), description, status(DRAFT|SCHEDULED|ACTIVE|PAUSED|COMPLETED|ARCHIVED), startDate, endDate, timezone, publishedAt, platforms:String[], requiredHashtags:String[], requiredMentions:String[], prohibitedContent:String[], eligibilityRules:Json, landingUrl, landingContent, isLeaderboardPublic, coverImageUrl, isPrivate, isProOnly, downloadVideos, activeRankingRuleId, rankingMetricType(VIEWS|VIEWS_X_ENGAGEMENT), requiresApproval, autoApproveCreators, affiliateLinkInstagram, affiliateLinkTiktok, affiliateLinkYoutube, affiliateLinkFacebook, affiliateLinkKwai, termsUrl, prizeInfo:Json, metadata:Json, createdAt }
  → organization, creator(User), client(User), activeRankingRule, rankingRules, applications, clipPosts, monthlyRankings, dailyRankings, fraudFlags, auditLogs, notifications, links, bucketVideos

rankingRule { id, campaignId, label, description, version, isActive, dailyEnabled, dailyTopCount, dailyTotalPrize, dailyTotalMonthBudget, dailyPrizeTable:Json, dailyWindowStart, dailyWindowEnd, dailyTimezone, dailyTiebreakerRules:Json, bonusEnabled, bonusMilestone, bonusAmount, bonusDeductFromDaily, bonusMonthlyBudgetCap, monthlyEnabled, monthlyTopCount, monthlyTotalPrize, monthlyPrizeTable:Json, monthlyTiebreakerRules:Json, monthlyThreshold100k, monthlyThreshold500k, primaryMetric, eligiblePlatforms:String[], countBestPlatformOnly, notes, automationConfig:Json }
  → campaign, activeCampaigns, monthlyRankings, dailyRankings

clipperProfile { id, userId(unique), fullName, artisticName, phone, cpf▲, pixKey▲, country, state, city, discordUsername, discordId, classesInterestedIn, instagramUsernames:String[], tiktokUsernames:String[], youtubeUsernames:String[], kwaiUsernames:String[], facebookUsernames:String[], niches:String[], tools:String[], postingFrequency, portfolioLinks:String[], avgViews:Int, avgEngagementRate:Float, bestVideoUrl, bestVideoViews:Int, weeklyCommitment, agreeToTerms, agreeToCompliance, verificationStatus(UNVERIFIED|PENDING|VERIFIED|REJECTED|BANNED), autoScore:Float, verifiedAt, metadata:Json, createdAt }
  → user, applications, wallet, socialAccounts, monthlyRankingEntries, links, kiwifySales, tiktokConnections

clientProfile { id, userId(unique), fullName, phone, cpf▲, company, position, website, country, state, city, notes, status(ACTIVE|INACTIVE|PENDING), metadata:Json }
  → user

socialAccount { id, clipperProfileId, platform(INSTAGRAM|TIKTOK|YOUTUBE|KWAI|FACEBOOK), username, profileUrl, isPrimary, isVerified, isActive, followers:Int, avgViews:Int, avgEngagementRate:Float, lastCheckedAt, metadata:Json }
  → clipperProfile, applicationAccounts

clipperApplication { id, campaignId, clipperProfileId, status(PENDING|UNDER_REVIEW|APPROVED|REJECTED|REVOKED), formData:Json, autoScore:Float, autoFlags:Json, autoDecision, reviewedBy, reviewedAt, reviewNotes, rejectionReason, approvedAt, createdAt }
  → campaign, clipperProfile, clipPosts, socialAccounts, monthlyRankingEntries, dailyRankingEntries
  @@unique([campaignId, clipperProfileId])

clipPost { id, campaignId, applicationId, platform(INSTAGRAM|TIKTOK|YOUTUBE|KWAI|FACEBOOK), submittedUrl, normalizedUrl, platformVideoId, username, caption, hashtags:String[], mentions:String[], thumbnailUrl, duration:Int, postedAt, views:BigInt, likes:Int, comments:Int, shares:Int, saves:Int, locationId, locationName, status(PENDING|ELIGIBLE|INELIGIBLE|DISQUALIFIED), eligibilityChecks:Json, ineligibilityReason, hasDuplicates, hasRequiredHashtags, hasRequiredMentions, isInDateRange, isPublicProfile, lastMetricsUpdate, metadata:Json, createdAt }
  → campaign, application, metricsHistory(ClipPostMetrics[]), fraudFlags, dailyRankingEntries, bucketVideo

clipPostMetrics { id, clipPostId, collectedAt, views:BigInt, likes:Int, comments:Int, shares:Int, saves:Int, engagementRate:Float, velocity24h:Float, velocity48h:Float, viewsDelta:BigInt, likesDelta:Int, commentsDelta:Int, sharesDelta:Int, savesDelta:Int }
  → clipPost

monthlyRanking { id, campaignId, rankingRuleId, monthPeriod, windowStart, windowEnd, totalParticipants:Int, totalPosts:Int, totalViews:BigInt, averageViews:Float, calculatedAt }
  → campaign, rankingRule, entries(MonthlyRankingEntry[])

monthlyRankingEntry { id, monthlyRankingId, clipperProfileId, applicationId, position:Int, previousPosition:Int, totalViews:BigInt, totalLikes:Int, totalComments:Int, totalShares:Int, totalSaves:Int, rankingScore:Float, postsCount:Int, averageViewsPerPost:Float, bestPostViews:BigInt, bestPostId, engagementRate:Float, videosOver100k:Int, videosOver500k:Int, firstPostDate, prizeAmount:Float, prizeStatus, clipperName, clipperUsername, clipperImageUrl, lastUpdated }
  → monthlyRanking, clipperProfile, application

dailyRanking { id, campaignId, rankingRuleId, rankingDate, totalPosts:Int, totalDailyViews:BigInt, totalClippers:Int, bestDailyViews:BigInt, averageViews:Float, calculatedAt }
  → campaign, rankingRule, entries(DailyRankingEntry[])

dailyRankingEntry { id, dailyRankingId, clipPostId, applicationId, position:Int, previousPosition:Int, dailyViews:BigInt, dailyLikes:Int, dailyComments:Int, dailyShares:Int, dailySaves:Int, dailyRankingScore:Float, totalViewsAtDate:BigInt, totalLikesAtDate:Int, totalCommentsAtDate:Int, totalSharesAtDate:Int, viewsFirst6h:BigInt, viewsFirst12h:BigInt, viewsGrowthRate:Float, engagementRate:Float, dailyPrizeAmount:Float, dailyPrizeStatus, qualifiesForBonus, bonusAmount:Float, bonusStatus, bonusAwardedAt, postUrl, postThumbnail, postCaption, platform, postedAt, clipperProfileId, clipperName, clipperUsername, clipperImageUrl, lastUpdated }
  → dailyRanking, clipPost, application

fraudFlag { id, campaignId, clipPostId, type(DUPLICATE|ANOMALOUS_ER|SUSPICIOUS_VELOCITY|MISSING_HASHTAG|MISSING_MENTION|OUT_OF_DATE_RANGE|PRIVATE_PROFILE|CONTENT_VIOLATION|BOT_ACTIVITY|OTHER), severity(LOW|MEDIUM|HIGH|CRITICAL), status(OPEN|UNDER_REVIEW|RESOLVED_VALID|RESOLVED_FALSE|IGNORED), message, details:Json, evidenceUrls:String[], reviewedBy, reviewedAt, reviewNotes, resolution }
  → campaign, clipPost, reviewer(User)

auditLog { id, userId, action(CREATE|UPDATE|DELETE|APPROVE|REJECT|ENABLE|DISABLE|EXPORT|LOGIN|LOGOUT), entityType, entityId, campaignId, changes:Json, metadata:Json, createdAt }
  → user, campaign

wallet { id, clipperProfileId(unique), balance:Float, totalEarned:Float, totalWithdrawn:Float, pendingWithdraw:Float, currency, isActive, blockedAt, blockReason }
  → clipperProfile, transactions

transaction { id, walletId, type(PRIZE_CREDIT|BONUS|ADJUSTMENT|WITHDRAWAL_REQUEST|WITHDRAWAL_APPROVED|WITHDRAWAL_REJECTED|WITHDRAWAL_COMPLETED|WITHDRAWAL_CANCELLED|REFUND|FEE), status(PENDING|PROCESSING|COMPLETED|REJECTED|CANCELLED|FAILED), amount:Float, balanceBefore:Float, balanceAfter:Float, currency, description, campaignId, clipPostId, rankingPosition:Int, withdrawalMethod(PIX|BANK_TRANSFER|PAYPAL|OTHER), processedBy, processedAt, rejectionReason, failureReason, proofUrls:String[] }
  → wallet

link { id, campaignId, clipperProfileId, originalUrl, shortId(unique), clicks:Int, sales:Int, successUrl }
  → campaign, clipperProfile

notification { id, userId, type, channel, title, message, actionUrl, isRead, readAt, sentAt, campaignId, clipPostId }
  → user, campaign

interestList { id, fullName, email, whatsapp, forWhom(MYSELF|REPRESENTING_PERSON|REPRESENTING_BRAND), instagramHandle, tiktokHandle, youtubeUrl, performanceLinks:String[], objectives, urgency(IMMEDIATE|SOON|PLANNING|EXPLORATORY), budget(RANGE_50_80|RANGE_80_200|RANGE_200_500|ABOVE_500|NOT_DEFINED), hasExperience, experienceFeedback, successMetrics:String[], additionalComments, agreeAuthority, agreePublicAnalysis, agreePrivacyAndTerms, status(PENDING|CONTACTED|QUALIFIED|DISQUALIFIED|CONVERTED), notes, assignedTo }

job { id, type, campaignId, status(PENDING|RUNNING|COMPLETED|FAILED|CANCELLED), priority:Int, input:Json, output:Json, error, startedAt, completedAt }

kiwifySale { id, kiwifyId(unique), reference, status(PAID|REFUNDED|CHARGEDBACK|WAITING_PAYMENT|EXPIRED|REFUSED), currency, netAmount:Int, productId, productName, customerEmail, affiliateDocument, affiliateAmount:Int, clipperProfileId, approvedDate, kiwifyCreatedAt }
  → clipperProfile

academyModule { id, title, slug(unique), description, coverImageUrl, order:Int, isPublished }
  → lessons

academyLesson { id, moduleId, title, slug(unique), description, videoUrl, thumbnailUrl, duration:Int, order:Int, isPublished, isFree }
  → module, progress, likes

academyLessonProgress { id, lessonId, userId, completed, watchedAt, progressPercent:Int }
  → lesson, user @@unique([lessonId, userId])

academyLessonLike { id, lessonId, userId } → lesson, user @@unique([lessonId, userId])

blogCategory { id, title, slug(unique), description, coverImageUrl, color, order:Int, isActive }
  → posts

blogPost { id, authorId, categoryId, title, slug(unique), excerpt, content, coverImageUrl, tags:String[], status(DRAFT|SCHEDULED|PUBLISHED|ARCHIVED), publishedAt, scheduledAt, isFeatured, isPinned, metaTitle, metaDescription, metaKeywords:String[], viewsCount:Int, likesCount:Int, commentsCount:Int, sharesCount:Int, readTimeMinutes:Int }
  → author(User), category, comments, likes, views

blogComment { id, postId, authorId, parentId, content, status(PENDING|APPROVED|REJECTED|SPAM), isPinned, likesCount:Int, editedAt }
  → post, author(User), parent, replies, likes

blogPostView { id, postId, userId, sessionId, ipHash▲, referrer, utmSource, utmMedium, userAgent, device, browser, os, country, region, readPercent:Int, timeOnPageSec:Int, viewedAt }
  → post

▲ = campo sensível (será automaticamente removido dos resultados)
`

function buildDateFilter(after?: string, before?: string) {
  if (!after && !before) return undefined
  const filter: Record<string, Date> = {}
  if (after) filter.gte = new Date(after)
  if (before) filter.lte = new Date(before)
  return filter
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export const SYSTEM_PROMPT = `Você é a **Clipfy AI**, assistente inteligente da plataforma Clipfy. Responda SEMPRE em português brasileiro (pt-BR).

═══ SOBRE A CLIPFY ═══
A Clipfy é uma plataforma brasileira de marketing de influência (fundada em 2025, ativa em 2026). Conecta CLIPADORES (criadores de cortes de vídeo) com EMPRESAS através de competições/ligas de engajamento nas redes sociais.

Fluxo: Empresa cria campanha → Clipadores se inscrevem → Criam vídeos curtos divulgando a marca → Clipfy rastreia métricas → Melhores clipadores (mais views/engajamento) vencem e recebem premiações.

Termos: Clipador = criador de cortes. Liga/Competição/Campanha = evento de uma empresa. Clip/Corte = vídeo curto. Ranking = classificação por desempenho. Premiação = dinheiro para vencedores.

═══ SUAS CAPACIDADES ═══
Você tem acesso a ferramentas que consultam o banco de dados da Clipfy em tempo real. Use-as SEMPRE que o usuário pedir dados, estatísticas, análises ou informações que precisem de consulta ao banco. Você pode chamar múltiplas ferramentas em sequência para cruzar dados e fazer análises complexas.

═══ FERRAMENTA SUPREMA: executeDynamicQuery ═══
Você tem uma ferramenta poderosa chamada **executeDynamicQuery** que permite executar QUALQUER query Prisma no banco de dados. Use-a quando:
- Nenhuma ferramenta específica atende à pergunta do usuário
- Precisa de joins complexos, filtros combinados ou agregações customizadas
- Quer cruzar dados de múltiplos modelos de formas não previstas pelas ferramentas dedicadas
- Precisa de contagens, somas, médias ou agrupamentos específicos

Com executeDynamicQuery você pode: findMany, findFirst, findUnique, count, aggregate, groupBy em QUALQUER modelo do banco.

O SCHEMA COMPLETO DO BANCO DE DADOS está abaixo para você construir queries precisas:
${DB_SCHEMA_REFERENCE}

═══ FERRAMENTAS ESPECIALIZADAS (prefira para casos comuns) ═══
Para análises de GESTÃO DE COMPETIÇÕES, prefira estas ferramentas especializadas quando aplicável:
- **getClipperCompetitionStats**: Performance COMPLETA de um clipador em cada competição
- **getCampaignClipperBreakdown**: Breakdown de TODOS os clipadores de uma campanha
- **getClipperPostsAnalysis**: Análise detalhada de cada post de um clipador
- **getCampaignPerformanceSummary**: Resumo executivo de campanha
- **getClipperFullProfile**: Perfil completo com stats de lifetime
- **getCampaignFullDetails**: Detalhes completos com métricas avançadas

Para buscas simples, use searchClippers, searchCampaigns, searchClipPosts, etc.

Quando as ferramentas específicas NÃO atendem → use executeDynamicQuery para construir a query exata.

═══ ESTRATÉGIA DE QUERY ═══
1. PRIMEIRO tente usar ferramentas especializadas para o caso de uso
2. Se precisar de dados mais específicos, use executeDynamicQuery
3. Para análises complexas, combine múltiplas chamadas de ferramentas
4. Para cruzamento de dados entre modelos, use executeDynamicQuery com include/select
5. Para agregações (totais, médias, agrupamentos), use aggregate ou groupBy no executeDynamicQuery

═══ REGRAS ═══
1. Use as ferramentas para buscar dados ANTES de responder perguntas sobre a plataforma.
2. Seja preciso — use números reais do banco, nunca invente dados.
3. Formate respostas com markdown rico (tabelas, listas, bold, headers).
4. Para análises complexas, cruze dados de múltiplas ferramentas.
5. NUNCA exponha dados sensíveis (CPF, chave PIX, tokens de acesso).
6. Se não encontrar dados, diga isso claramente.
7. Dê insights e recomendações além dos dados brutos quando relevante.
8. Use emojis de forma sutil e profissional para destacar pontos-chave.
9. Estamos em 2026 — considere isso no contexto.
10. Quando perguntar sobre clipadores, SEMPRE use as ferramentas avançadas para dados completos de views, posts, média de views/post, posts/dia, prêmios e plataformas.
11. Ao apresentar rankings ou comparações, use tabelas markdown para clareza visual.
12. Com executeDynamicQuery, construa queries otimizadas: use select para limitar campos, take para limitar resultados, e where para filtrar precisamente.
13. Se uma query falhar, analise o erro e corrija a query automaticamente (campo errado, tipo incorreto, etc.).`

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS — Schemas enviados à OpenAI para function calling
// ═══════════════════════════════════════════════════════════════════════════════

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CLIPPER — Buscar clipadores com filtros diversos
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "searchClippers",
      description:
        "Busca clipadores cadastrados na plataforma com filtros. Retorna lista de clipadores com perfil básico, redes sociais, status de verificação, nicho e contagens. Use para encontrar clipadores por nome, localização, nicho, período de cadastro, assinatura ou status.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Nome completo ou artístico do clipador (busca parcial)",
          },
          verificationStatus: {
            type: "string",
            enum: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "BANNED"],
            description: "Status de verificação do clipador",
          },
          niches: {
            type: "array",
            items: { type: "string" },
            description: "Nichos de atuação (ex: 'humor', 'games', 'lifestyle')",
          },
          state: {
            type: "string",
            description: "Estado brasileiro (ex: 'SP', 'RJ', 'MG')",
          },
          city: {
            type: "string",
            description: "Cidade (busca parcial)",
          },
          subscriptionTier: {
            type: "string",
            enum: ["NONE", "PRO", "ULTRA"],
            description: "Nível de assinatura do clipador",
          },
          createdAfter: {
            type: "string",
            description: "Data mínima de cadastro (ISO 8601, ex: '2026-01-01')",
          },
          createdBefore: {
            type: "string",
            description: "Data máxima de cadastro (ISO 8601)",
          },
          sortBy: {
            type: "string",
            enum: ["createdAt_desc", "createdAt_asc", "fullName_asc", "autoScore_desc"],
            description: "Ordenação dos resultados",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20, máximo: 50)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CLIPPER — Perfil completo de um clipador específico
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getClipperFullProfile",
      description:
        "Retorna o perfil COMPLETO de um clipador: dados pessoais, redes sociais, nichos, campanhas, carteira financeira E agora com lifetimeStats (views totais em todas as campanhas, total de posts, média de views/post, prêmios acumulados, breakdown por plataforma, campanhas participadas vs aprovadas). Use para uma visão geral completa do clipador.",
      parameters: {
        type: "object",
        properties: {
          clipperProfileId: {
            type: "string",
            description: "ID do perfil do clipador",
          },
          userId: {
            type: "string",
            description: "ID do usuário (alternativa ao clipperProfileId)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CLIPPER — Histórico de rankings de um clipador em competições
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getClipperRankingHistory",
      description:
        "Retorna o histórico de rankings mensais de um clipador em todas as campanhas: posição, views, score, premiações ganhas. Use para analisar a evolução de performance de um clipador ao longo do tempo.",
      parameters: {
        type: "object",
        properties: {
          clipperProfileId: {
            type: "string",
            description: "ID do perfil do clipador",
          },
          campaignId: {
            type: "string",
            description: "Filtrar por campanha específica (opcional)",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20)",
          },
        },
        required: ["clipperProfileId"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CAMPANHA — Buscar campanhas/competições
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "searchCampaigns",
      description:
        "Busca campanhas/competições/ligas da Clipfy com filtros. Retorna dados da campanha, organização, contagens de inscritos e clips. Use para encontrar campanhas por status, período, organização.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"],
            description: "Status da campanha",
          },
          organizationId: {
            type: "string",
            description: "ID da organização dona da campanha",
          },
          createdAfter: {
            type: "string",
            description: "Data mínima de criação (ISO 8601)",
          },
          createdBefore: {
            type: "string",
            description: "Data máxima de criação (ISO 8601)",
          },
          searchName: {
            type: "string",
            description: "Busca parcial pelo nome da campanha",
          },
          sortBy: {
            type: "string",
            enum: ["createdAt_desc", "createdAt_asc", "startDate_desc", "startDate_asc", "name_asc"],
            description: "Ordenação dos resultados",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20, máximo: 50)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CAMPANHA — Detalhes completos de uma campanha
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getCampaignFullDetails",
      description:
        "Retorna detalhes COMPLETOS de uma campanha: configurações, regras, plataformas, hashtags, organização, contagens, E agora com métricas avançadas (posts/dia, clipadores únicos que postaram, engajamento geral, breakdown por plataforma com views/posts/avg, top 5 clipadores preview). Use para análise profunda de uma campanha.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "ID da campanha",
          },
          slug: {
            type: "string",
            description: "Slug da campanha (alternativa ao ID)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. CAMPANHA — Ranking mensal ou diário
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getCampaignRanking",
      description:
        "Retorna o ranking de uma campanha (mensal ou diário). Inclui posição, nome do clipador, views, score, engajamento e premiações. Use para ver quem está ganhando ou como está a competição.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "ID da campanha",
          },
          type: {
            type: "string",
            enum: ["monthly", "daily"],
            description: "Tipo de ranking: mensal ou diário",
          },
          period: {
            type: "string",
            description: "Período do ranking. Para mensal: 'YYYY-MM' (ex: '2026-03'). Para diário: 'YYYY-MM-DD'. Se omitido, retorna o mais recente.",
          },
          limit: {
            type: "number",
            description: "Máximo de posições (padrão: 20, máximo: 50)",
          },
        },
        required: ["campaignId", "type"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. CAMPANHA — Funil de aplicações/inscrições
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getCampaignApplications",
      description:
        "Retorna as aplicações/inscrições de clipadores em uma campanha com funil de status (pendentes, aprovados, rejeitados, etc). Use para análise de conversão e gestão de inscritos.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "ID da campanha",
          },
          status: {
            type: "string",
            enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVOKED"],
            description: "Filtrar por status de aplicação",
          },
          sortBy: {
            type: "string",
            enum: ["createdAt_desc", "createdAt_asc", "autoScore_desc"],
            description: "Ordenação dos resultados",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20, máximo: 50)",
          },
        },
        required: ["campaignId"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. CLIPS — Buscar clip posts com filtros
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "searchClipPosts",
      description:
        "Busca clips/vídeos postados em campanhas com filtros de plataforma, status, username, views e período. Retorna dados do clip com métricas e informações do clipador. Use para análise de conteúdo e performance.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "Filtrar por campanha",
          },
          platform: {
            type: "string",
            enum: ["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"],
            description: "Filtrar por plataforma",
          },
          status: {
            type: "string",
            enum: ["PENDING", "ELIGIBLE", "INELIGIBLE", "DISQUALIFIED"],
            description: "Status de elegibilidade do clip",
          },
          username: {
            type: "string",
            description: "Username do criador na plataforma",
          },
          minViews: {
            type: "number",
            description: "Mínimo de views",
          },
          postedAfter: {
            type: "string",
            description: "Data mínima de postagem (ISO 8601)",
          },
          postedBefore: {
            type: "string",
            description: "Data máxima de postagem (ISO 8601)",
          },
          sortBy: {
            type: "string",
            enum: ["views_desc", "views_asc", "likes_desc", "postedAt_desc", "postedAt_asc", "createdAt_desc"],
            description: "Ordenação dos resultados",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20, máximo: 50)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. CLIPS — Detalhes completos de um clip + histórico de métricas
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getClipPostDetails",
      description:
        "Retorna detalhes COMPLETOS de um clip/vídeo: métricas atuais, histórico de evolução de métricas ao longo do tempo, flags de fraude, e entradas de ranking. Use para análise profunda de um clip específico.",
      parameters: {
        type: "object",
        properties: {
          clipPostId: {
            type: "string",
            description: "ID do clip post",
          },
        },
        required: ["clipPostId"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. CLIPS — Top clips por performance
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getTopClips",
      description:
        "Retorna os clips com melhor performance por views, likes ou engajamento. Pode filtrar por campanha, plataforma ou período. Use para encontrar os melhores conteúdos da plataforma.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "Filtrar por campanha",
          },
          platform: {
            type: "string",
            enum: ["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"],
            description: "Filtrar por plataforma",
          },
          metric: {
            type: "string",
            enum: ["views", "likes", "comments", "shares"],
            description: "Métrica para ordenação (padrão: views)",
          },
          postedAfter: {
            type: "string",
            description: "Data mínima de postagem (ISO 8601)",
          },
          postedBefore: {
            type: "string",
            description: "Data máxima de postagem (ISO 8601)",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 10, máximo: 50)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. FINANCEIRO — Visão geral financeira da plataforma
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getFinancialOverview",
      description:
        "Retorna visão geral financeira da plataforma: total distribuído em premiações, total pendente de saque, saldo agregado das carteiras, contagem de transações por tipo/status. Use para análise financeira geral.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. FINANCEIRO — Buscar transações
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "searchTransactions",
      description:
        "Busca transações financeiras (premiações, saques, ajustes) com filtros de tipo, status, clipador e período. Retorna detalhes das transações com informações do clipador.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "PRIZE_CREDIT", "BONUS", "ADJUSTMENT",
              "WITHDRAWAL_REQUEST", "WITHDRAWAL_APPROVED", "WITHDRAWAL_REJECTED",
              "WITHDRAWAL_COMPLETED", "WITHDRAWAL_CANCELLED", "REFUND", "FEE",
            ],
            description: "Tipo de transação",
          },
          status: {
            type: "string",
            enum: ["PENDING", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED", "FAILED"],
            description: "Status da transação",
          },
          clipperProfileId: {
            type: "string",
            description: "Filtrar por clipador (ID do perfil)",
          },
          createdAfter: {
            type: "string",
            description: "Data mínima (ISO 8601)",
          },
          createdBefore: {
            type: "string",
            description: "Data máxima (ISO 8601)",
          },
          sortBy: {
            type: "string",
            enum: ["createdAt_desc", "createdAt_asc", "amount_desc", "amount_asc"],
            description: "Ordenação",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20, máximo: 50)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. PLATAFORMA — Estatísticas gerais
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getPlatformOverview",
      description:
        "Retorna estatísticas gerais da plataforma: total de usuários por role, assinantes por tier, clipadores por status de verificação, total de campanhas por status, total de organizações, total de clips postados e mais. Use para visão geral da saúde da plataforma.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. BLOG — Métricas e analytics do blog
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getBlogAnalytics",
      description:
        "Retorna analytics do blog 'Central do Clipador': total de posts por status, total de views, likes, comentários, top posts, views por dispositivo/país. Use para análise de performance do blog.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["7d", "30d", "90d", "all"],
            description: "Período da análise (padrão: 30d)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. BLOG — Buscar posts do blog
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "searchBlogPosts",
      description:
        "Busca posts do blog com filtros de status, categoria, tags, período e texto. Retorna título, views, likes, autor e data. Use para encontrar conteúdos do blog.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
            description: "Status do post",
          },
          categorySlug: {
            type: "string",
            description: "Slug da categoria",
          },
          query: {
            type: "string",
            description: "Busca por texto no título ou conteúdo",
          },
          publishedAfter: {
            type: "string",
            description: "Data mínima de publicação (ISO 8601)",
          },
          publishedBefore: {
            type: "string",
            description: "Data máxima de publicação (ISO 8601)",
          },
          sortBy: {
            type: "string",
            enum: ["publishedAt_desc", "publishedAt_asc", "viewsCount_desc", "likesCount_desc"],
            description: "Ordenação",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. LEADS — Analytics da lista de interesse
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getLeadsAnalytics",
      description:
        "Retorna analytics da lista de interesse/leads: contagem por status, urgência, faixa de orçamento, e os leads mais recentes. Use para análise do funil de vendas e qualidade dos leads.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 17. FRAUDE — Flags de fraude e violações
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getFraudAlerts",
      description:
        "Retorna flags de fraude e violações de regras em clips e campanhas. Filtra por campanha, status, severidade. Use para monitorar integridade e compliance da plataforma.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "Filtrar por campanha",
          },
          status: {
            type: "string",
            enum: ["OPEN", "UNDER_REVIEW", "RESOLVED_VALID", "RESOLVED_FALSE", "IGNORED"],
            description: "Status da flag",
          },
          severity: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            description: "Severidade",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 20)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 18. AUDITORIA — Log de atividades recentes
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getAuditLog",
      description:
        "Retorna log de atividades e ações recentes na plataforma: criações, atualizações, aprovações, rejeições, logins. Use para auditoria, análise de uso e segurança.",
      parameters: {
        type: "object",
        properties: {
          userId: {
            type: "string",
            description: "Filtrar ações de um usuário específico",
          },
          action: {
            type: "string",
            enum: ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "ENABLE", "DISABLE", "EXPORT", "LOGIN", "LOGOUT"],
            description: "Tipo de ação",
          },
          entityType: {
            type: "string",
            description: "Tipo de entidade afetada (ex: 'Campaign', 'ClipperProfile', 'BlogPost')",
          },
          createdAfter: {
            type: "string",
            description: "Data mínima (ISO 8601)",
          },
          createdBefore: {
            type: "string",
            description: "Data máxima (ISO 8601)",
          },
          limit: {
            type: "number",
            description: "Máximo de resultados (padrão: 30)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 19. ORGANIZAÇÃO — Detalhes de uma organização
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getOrganizationDetails",
      description:
        "Retorna detalhes de uma organização/empresa: informações gerais, membros, quotas, e campanhas associadas. Use para análise de parceiros e empresas.",
      parameters: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            description: "ID da organização",
          },
          slug: {
            type: "string",
            description: "Slug da organização (alternativa ao ID)",
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 20. ACADEMIA — Estatísticas da Academia Clipadora
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getAcademyStats",
      description:
        "Retorna estatísticas da Academia Clipadora: total de módulos, aulas, aulas concluídas, likes, progresso dos alunos. Use para análise de engajamento educacional.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 21. CLIPPER — Performance detalhada em TODAS as competições
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getClipperCompetitionStats",
      description:
        "Retorna a performance COMPLETA de um clipador em CADA competição que participou: views totais, posts, média de views/post, média de posts/dia, dias ativos, melhor post, premiações acumuladas (diária+mensal+bônus), posições no ranking, breakdown por plataforma, engajamento, vídeos acima de 100k e 500k views. ESSENCIAL para avaliar a qualidade e consistência de um clipador como gestor.",
      parameters: {
        type: "object",
        properties: {
          clipperProfileId: {
            type: "string",
            description: "ID do perfil do clipador",
          },
          campaignId: {
            type: "string",
            description: "Filtrar por uma campanha específica (opcional — se omitido, retorna todas)",
          },
        },
        required: ["clipperProfileId"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 22. CAMPANHA — Breakdown detalhado de performance por clipador
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getCampaignClipperBreakdown",
      description:
        "Retorna breakdown detalhado de TODOS os clipadores de uma campanha com métricas individuais: views totais, posts, média de views/post, média de posts/dia, dias ativos, melhor post, premiações acumuladas, posição no ranking, plataformas usadas, engajamento, compliance de hashtags/menções. FERRAMENTA PRINCIPAL para gestores de competição avaliarem o desempenho comparativo dos clipadores.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "ID da campanha",
          },
          sortBy: {
            type: "string",
            enum: ["views_desc", "posts_desc", "avgViews_desc", "prizes_desc", "engagement_desc", "postsPerDay_desc"],
            description: "Ordenação dos clipadores (padrão: views_desc)",
          },
          minPosts: {
            type: "number",
            description: "Filtrar apenas clipadores com no mínimo X posts",
          },
          platform: {
            type: "string",
            enum: ["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"],
            description: "Filtrar posts por plataforma específica",
          },
          limit: {
            type: "number",
            description: "Máximo de clipadores retornados (padrão: 30, máximo: 100)",
          },
        },
        required: ["campaignId"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 23. CLIPPER — Análise detalhada de posts com frequência e performance
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getClipperPostsAnalysis",
      description:
        "Retorna análise detalhada de TODOS os posts de um clipador (opcionalmente em uma campanha): cada post com views, likes, comments, shares, plataforma, URL, data. Inclui análise de frequência de postagem (posts/dia, posts/semana), performance por plataforma, compliance de hashtags/menções, melhor e pior post, tendência de crescimento. Use para entender os hábitos e a qualidade de produção de conteúdo de um clipador.",
      parameters: {
        type: "object",
        properties: {
          clipperProfileId: {
            type: "string",
            description: "ID do perfil do clipador",
          },
          campaignId: {
            type: "string",
            description: "Filtrar posts de uma campanha específica (opcional)",
          },
          platform: {
            type: "string",
            enum: ["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"],
            description: "Filtrar por plataforma",
          },
          sortBy: {
            type: "string",
            enum: ["views_desc", "views_asc", "postedAt_desc", "postedAt_asc", "likes_desc", "engagement_desc"],
            description: "Ordenação dos posts (padrão: views_desc)",
          },
          limit: {
            type: "number",
            description: "Máximo de posts retornados (padrão: 50, máximo: 200)",
          },
        },
        required: ["clipperProfileId"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 24. CAMPANHA — Resumo de performance geral com tendências
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getCampaignPerformanceSummary",
      description:
        "Retorna um resumo executivo de performance de uma campanha: views totais, posts totais, clipadores únicos, views por plataforma, posts por plataforma, média de views/post, média de posts/dia, tendência de views diárias (últimos 30 dias), funil de conversão (inscrições→aprovados→postaram), distribuição de premiações, e comparação de métricas entre plataformas. IDEAL para relatórios gerenciais e acompanhamento de campanhas.",
      parameters: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "ID da campanha",
          },
          slug: {
            type: "string",
            description: "Slug da campanha (alternativa ao ID)",
          },
        },
        required: [],
      },
    },
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // 25. DYNAMIC QUERY — AI constrói queries Prisma livremente
  // ─────────────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "executeDynamicQuery",
      description: `Executa uma query Prisma dinâmica construída pela AI. SOMENTE operações de leitura são permitidas. Use esta ferramenta quando as outras ferramentas específicas não atendem à necessidade do usuário — por exemplo, joins complexos, filtros combinados, agregações específicas, ou qualquer consulta que não existe como ferramenta dedicada.

MODELOS DISPONÍVEIS: user, organization, organizationMember, campaign, rankingRule, clipperProfile, clientProfile, socialAccount, clipperApplication, applicationSocialAccount, clipPost, clipPostMetrics, metricsExtractionFailure, monthlyRanking, monthlyRankingEntry, dailyRanking, dailyRankingEntry, fraudFlag, auditLog, wallet, transaction, link, notification, interestList, job, kiwifySale, academyModule, academyLesson, academyLessonProgress, academyLessonLike, tiktokConnection, clipPostBucketVideo, blogCategory, blogPost, blogComment, blogPostLike, blogCommentLike, blogPostView, webhookEndpoint, webhookDelivery, quotaUsage

OPERAÇÕES PERMITIDAS: findMany, findFirst, findUnique, count, aggregate, groupBy

O schema completo do banco está disponível no system prompt (DB_SCHEMA_REFERENCE). Use-o para construir queries precisas.

EXEMPLOS DE USO:
1. Clipadores que mais postaram na última semana:
   model="clipPost", operation="groupBy", args={ by: ["applicationId"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10, where: { createdAt: { gte: "2026-03-09T00:00:00Z" } } }

2. Total de views por plataforma em uma campanha:
   model="clipPost", operation="groupBy", args={ by: ["platform"], where: { campaignId: "xxx" }, _sum: { views: true }, _count: { id: true } }

3. Clipadores com wallet bloqueada:
   model="wallet", operation="findMany", args={ where: { isActive: false }, include: { clipperProfile: { select: { fullName: true, userId: true } } } }

4. Posts com crescimento anômalo de views:
   model="clipPostMetrics", operation="findMany", args={ where: { velocity24h: { gt: 500 } }, include: { clipPost: { select: { submittedUrl: true, platform: true, username: true } } }, take: 20, orderBy: { velocity24h: "desc" } }

REGRAS:
- Máximo 200 resultados para findMany
- Campos sensíveis (cpf, pixKey, tokens, etc.) são automaticamente removidos dos resultados
- Para BigInt (views), os valores são automaticamente convertidos para Number
- Use "include" para trazer relações e "select" para limitar campos retornados
- Datas devem ser strings ISO-8601 (ex: "2026-01-01T00:00:00Z")
- Para aggregate, use _sum, _avg, _min, _max, _count como propriedades do args`,
      parameters: {
        type: "object",
        properties: {
          model: {
            type: "string",
            description: "Nome do modelo Prisma (camelCase). Ex: clipperProfile, campaign, clipPost, monthlyRankingEntry, etc.",
          },
          operation: {
            type: "string",
            enum: ["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"],
            description: "Operação Prisma a executar (somente leitura)",
          },
          args: {
            type: "object",
            description: "Argumentos da query Prisma. Pode conter: where, select, include, orderBy, take, skip, distinct, cursor (para findMany/findFirst); where (para findUnique/count); _sum, _avg, _min, _max, _count, by, having (para aggregate/groupBy). Exemplo: { where: { status: \"ACTIVE\" }, take: 10, orderBy: { createdAt: \"desc\" }, include: { clipPosts: true } }",
          },
        },
        required: ["model", "operation", "args"],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Funções Prisma que executam as buscas no banco
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. Buscar clipadores com filtros ─────────────────────────────────────────

async function toolSearchClippers(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = {}

  if (args.name) {
    where.OR = [
      { fullName: { contains: args.name as string, mode: "insensitive" } },
      { artisticName: { contains: args.name as string, mode: "insensitive" } },
    ]
  }
  if (args.verificationStatus) where.verificationStatus = args.verificationStatus
  if (args.niches && Array.isArray(args.niches)) where.niches = { hasSome: args.niches }
  if (args.state) where.state = args.state
  if (args.city) where.city = { contains: args.city as string, mode: "insensitive" }
  if (args.subscriptionTier) where.user = { subscriptionTier: args.subscriptionTier }

  const dateFilter = buildDateFilter(args.createdAfter as string, args.createdBefore as string)
  if (dateFilter) where.createdAt = dateFilter

  const orderMap: Record<string, unknown> = {
    createdAt_desc: { createdAt: "desc" },
    createdAt_asc: { createdAt: "asc" },
    fullName_asc: { fullName: "asc" },
    autoScore_desc: { autoScore: "desc" },
  }

  const results = await (db.clipperProfile as any).findMany({
    where,
    include: {
      user: {
        select: {
          id: true, name: true, email: true, imageUrl: true,
          role: true, subscriptionTier: true, subscriptionStatus: true,
          createdAt: true,
        },
      },
      _count: {
        select: { applications: true, socialAccounts: true },
      },
    },
    orderBy: orderMap[args.sortBy as string] || { createdAt: "desc" },
    take: limit,
  })

  const total = await (db.clipperProfile as any).count({ where })

  return {
    _meta: { totalCount: total, returned: results.length, hasMore: total > results.length },
    data: results.map((r: any) => stripSensitiveClipper(serialize(r) as Record<string, unknown>)),
  }
}

// ── 2. Perfil completo de um clipador ────────────────────────────────────────

async function toolGetClipperFullProfile(db: DB, args: Record<string, unknown>) {
  const where: Record<string, unknown> = {}
  if (args.clipperProfileId) where.id = args.clipperProfileId
  else if (args.userId) where.userId = args.userId
  else return { data: null, _meta: { error: "Forneça clipperProfileId ou userId" } }

  const profile = await (db.clipperProfile as any).findFirst({
    where,
    include: {
      user: {
        select: {
          id: true, name: true, email: true, imageUrl: true, role: true,
          subscriptionTier: true, subscriptionStatus: true,
          createdAt: true, updatedAt: true,
        },
      },
      socialAccounts: {
        where: { isActive: true },
        select: {
          id: true, platform: true, username: true, profileUrl: true,
          isPrimary: true, isVerified: true, followers: true,
          avgViews: true, avgEngagementRate: true, lastCheckedAt: true,
        },
      },
      applications: {
        select: {
          id: true, status: true, autoScore: true, createdAt: true,
          campaign: { select: { id: true, name: true, slug: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      wallet: {
        select: {
          balance: true, totalEarned: true, totalWithdrawn: true,
          pendingWithdraw: true, currency: true, isActive: true,
        },
      },
      _count: {
        select: {
          applications: true, socialAccounts: true,
          monthlyRankingEntries: true, links: true,
        },
      },
    },
  })

  if (!profile) return { data: null, _meta: { error: "Clipador não encontrado" } }

  const appIds = profile.applications.map((a: any) => a.id)

  const [postAgg, prizeAgg, dailyPrizeAgg, postsByPlatform] = await Promise.all([
    appIds.length > 0
      ? (db.clipPost as any).aggregate({
          where: { applicationId: { in: appIds }, status: "ELIGIBLE" },
          _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
          _count: true,
        })
      : { _sum: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }, _count: 0 },
    appIds.length > 0
      ? (db.monthlyRankingEntry as any).aggregate({
          where: { applicationId: { in: appIds } },
          _sum: { prizeAmount: true },
          _count: true,
        })
      : { _sum: { prizeAmount: 0 }, _count: 0 },
    appIds.length > 0
      ? (db.dailyRankingEntry as any).aggregate({
          where: { applicationId: { in: appIds } },
          _sum: { dailyPrizeAmount: true, bonusAmount: true },
        })
      : { _sum: { dailyPrizeAmount: 0, bonusAmount: 0 } },
    appIds.length > 0
      ? (db.clipPost as any).groupBy({
          by: ["platform"],
          where: { applicationId: { in: appIds }, status: "ELIGIBLE" },
          _count: true,
          _sum: { views: true },
        })
      : [],
  ])

  const lifetimeStats = {
    totalViews: Number(postAgg._sum?.views || 0),
    totalLikes: Number(postAgg._sum?.likes || 0),
    totalComments: Number(postAgg._sum?.comments || 0),
    totalShares: Number(postAgg._sum?.shares || 0),
    totalSaves: Number(postAgg._sum?.saves || 0),
    totalPosts: postAgg._count || 0,
    avgViewsPerPost: postAgg._count > 0
      ? Math.round(Number(postAgg._sum?.views || 0) / postAgg._count) : 0,
    totalPrizesEarned:
      Number(prizeAgg._sum?.prizeAmount || 0) +
      Number(dailyPrizeAgg._sum?.dailyPrizeAmount || 0) +
      Number(dailyPrizeAgg._sum?.bonusAmount || 0),
    monthlyPrizeEntries: prizeAgg._count || 0,
    platformBreakdown: (postsByPlatform as any[]).map((p: any) => ({
      platform: p.platform,
      posts: p._count,
      views: Number(p._sum?.views || 0),
    })),
    campaignsParticipated: profile.applications.length,
    campaignsApproved: profile.applications.filter((a: any) => a.status === "APPROVED").length,
  }

  return {
    data: stripSensitiveClipper(serialize({ ...profile, lifetimeStats }) as Record<string, unknown>),
  }
}

// ── 3. Histórico de rankings de um clipador ──────────────────────────────────

async function toolGetClipperRankingHistory(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = { clipperProfileId: args.clipperProfileId }

  if (args.campaignId) {
    where.monthlyRanking = { campaignId: args.campaignId }
  }

  const entries = await (db.monthlyRankingEntry as any).findMany({
    where,
    select: {
      position: true, previousPosition: true, totalViews: true,
      totalLikes: true, totalComments: true, totalShares: true,
      rankingScore: true, postsCount: true, averageViewsPerPost: true,
      bestPostViews: true, engagementRate: true, prizeAmount: true,
      prizeStatus: true, videosOver100k: true, videosOver500k: true,
      createdAt: true,
      monthlyRanking: {
        select: {
          monthPeriod: true, totalParticipants: true,
          campaign: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return {
    _meta: { returned: entries.length },
    data: serialize(entries),
  }
}

// ── 4. Buscar campanhas ──────────────────────────────────────────────────────

async function toolSearchCampaigns(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = {}

  if (args.status) where.status = args.status
  if (args.organizationId) where.organizationId = args.organizationId
  if (args.searchName) where.name = { contains: args.searchName as string, mode: "insensitive" }

  const dateFilter = buildDateFilter(args.createdAfter as string, args.createdBefore as string)
  if (dateFilter) where.createdAt = dateFilter

  const orderMap: Record<string, unknown> = {
    createdAt_desc: { createdAt: "desc" },
    createdAt_asc: { createdAt: "asc" },
    startDate_desc: { startDate: "desc" },
    startDate_asc: { startDate: "asc" },
    name_asc: { name: "asc" },
  }

  const results = await (db.campaign as any).findMany({
    where,
    select: {
      id: true, name: true, slug: true, status: true,
      startDate: true, endDate: true, platforms: true,
      isPrivate: true, isProOnly: true, rankingMetricType: true,
      coverImageUrl: true, createdAt: true,
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      _count: { select: { applications: true, clipPosts: true } },
    },
    orderBy: orderMap[args.sortBy as string] || { createdAt: "desc" },
    take: limit,
  })

  const total = await (db.campaign as any).count({ where })

  return {
    _meta: { totalCount: total, returned: results.length, hasMore: total > results.length },
    data: serialize(results),
  }
}

// ── 5. Detalhes completos de uma campanha ────────────────────────────────────

async function toolGetCampaignFullDetails(db: DB, args: Record<string, unknown>) {
  const where: Record<string, unknown> = {}
  if (args.campaignId) where.id = args.campaignId
  else if (args.slug) where.slug = args.slug
  else return { data: null, _meta: { error: "Forneça campaignId ou slug" } }

  const campaign = await (db.campaign as any).findFirst({
    where,
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true, website: true } },
      creator: { select: { id: true, name: true, email: true } },
      activeRankingRule: {
        select: {
          id: true, label: true, dailyEnabled: true, dailyTopCount: true,
          dailyTotalPrize: true, monthlyEnabled: true, monthlyTopCount: true,
          monthlyTotalPrize: true, primaryMetric: true, bonusEnabled: true,
          bonusMilestone: true, bonusAmount: true,
        },
      },
      _count: {
        select: {
          applications: true, clipPosts: true, monthlyRankings: true,
          dailyRankings: true, fraudFlags: true,
        },
      },
    },
  })

  if (!campaign) return { data: null, _meta: { error: "Campanha não encontrada" } }

  const [applicationStats, clipStats, clipsByPlatform, uniqueClippers, topClippers] =
    await Promise.all([
      (db.clipperApplication as any).groupBy({
        by: ["status"],
        where: { campaignId: campaign.id },
        _count: true,
      }),
      (db.clipPost as any).aggregate({
        where: { campaignId: campaign.id, status: "ELIGIBLE" },
        _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
        _count: true,
        _avg: { views: true, likes: true },
        _max: { views: true },
      }),
      (db.clipPost as any).groupBy({
        by: ["platform"],
        where: { campaignId: campaign.id, status: "ELIGIBLE" },
        _count: true,
        _sum: { views: true, likes: true },
        _avg: { views: true },
      }),
      (db.clipPost as any).findMany({
        where: { campaignId: campaign.id, status: "ELIGIBLE" },
        select: { applicationId: true },
        distinct: ["applicationId"],
      }),
      (db.monthlyRankingEntry as any).findMany({
        where: {
          monthlyRanking: { campaignId: campaign.id },
        },
        select: {
          clipperName: true, clipperUsername: true, totalViews: true,
          postsCount: true, averageViewsPerPost: true, engagementRate: true,
          position: true, prizeAmount: true,
          monthlyRanking: { select: { monthPeriod: true } },
        },
        orderBy: { totalViews: "desc" },
        take: 5,
      }),
    ])

  const campaignDays = Math.max(1, Math.ceil(
    (new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24),
  ))
  const elapsedDays = Math.max(1, Math.min(campaignDays, Math.ceil(
    (Date.now() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24),
  )))

  return {
    data: serialize({
      ...campaign,
      applicationFunnel: applicationStats,
      clipAggregates: {
        ...clipStats,
        maxViewsSinglePost: Number(clipStats._max?.views || 0),
        avgLikesPerPost: Number(clipStats._avg?.likes || 0),
      },
      advancedMetrics: {
        uniqueClippersPosted: uniqueClippers.length,
        avgPostsPerDay: Number(((clipStats._count || 0) / elapsedDays).toFixed(2)),
        avgPostsPerClipper: uniqueClippers.length > 0
          ? Number(((clipStats._count || 0) / uniqueClippers.length).toFixed(1)) : 0,
        campaignDuration: campaignDays,
        daysElapsed: elapsedDays,
        engagementRate: calculateEngagementRate(
          Number(clipStats._sum?.views || 0),
          Number(clipStats._sum?.likes || 0),
          Number(clipStats._sum?.comments || 0),
          Number(clipStats._sum?.shares || 0),
          Number(clipStats._sum?.saves || 0)
        ),
      },
      platformBreakdown: clipsByPlatform,
      topClippersPreview: topClippers,
    }),
  }
}

// ── 6. Ranking mensal ou diário de uma campanha ──────────────────────────────

async function toolGetCampaignRanking(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const campaignId = args.campaignId as string
  const type = args.type as string

  if (type === "monthly") {
    let rankingWhere: Record<string, unknown> = { campaignId }
    if (args.period) rankingWhere = { ...rankingWhere, monthPeriod: args.period }

    const ranking = await (db.monthlyRanking as any).findFirst({
      where: rankingWhere,
      orderBy: { calculatedAt: "desc" },
      select: {
        id: true, monthPeriod: true, totalParticipants: true,
        totalPosts: true, totalViews: true, averageViews: true, calculatedAt: true,
        entries: {
          select: {
            position: true, previousPosition: true, clipperName: true,
            clipperUsername: true, clipperImageUrl: true, totalViews: true,
            totalLikes: true, totalComments: true, totalShares: true,
            rankingScore: true, postsCount: true, averageViewsPerPost: true,
            engagementRate: true, prizeAmount: true, prizeStatus: true,
            videosOver100k: true, videosOver500k: true,
          },
          orderBy: { position: "asc" },
          take: limit,
        },
      },
    })

    if (!ranking) return { data: null, _meta: { error: "Nenhum ranking mensal encontrado" } }
    return { data: serialize(ranking) }
  }

  // Daily
  let dailyWhere: Record<string, unknown> = { campaignId }
  if (args.period) dailyWhere = { ...dailyWhere, rankingDate: new Date(args.period as string) }

  const ranking = await (db.dailyRanking as any).findFirst({
    where: dailyWhere,
    orderBy: { rankingDate: "desc" },
    select: {
      id: true, rankingDate: true, totalPosts: true,
      totalDailyViews: true, totalClippers: true, bestDailyViews: true,
      averageViews: true, calculatedAt: true,
      entries: {
        select: {
          position: true, previousPosition: true, clipperName: true,
          clipperUsername: true, clipperImageUrl: true,
          dailyViews: true, dailyLikes: true, dailyComments: true, dailyShares: true,
          dailyRankingScore: true, engagementRate: true,
          dailyPrizeAmount: true, dailyPrizeStatus: true,
          qualifiesForBonus: true, bonusAmount: true,
          platform: true, postUrl: true, postCaption: true, postedAt: true,
        },
        orderBy: { position: "asc" },
        take: limit,
      },
    },
  })

  if (!ranking) return { data: null, _meta: { error: "Nenhum ranking diário encontrado" } }
  return { data: serialize(ranking) }
}

// ── 7. Aplicações de clipadores em uma campanha ──────────────────────────────

async function toolGetCampaignApplications(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = { campaignId: args.campaignId }

  if (args.status) where.status = args.status

  const orderMap: Record<string, unknown> = {
    createdAt_desc: { createdAt: "desc" },
    createdAt_asc: { createdAt: "asc" },
    autoScore_desc: { autoScore: "desc" },
  }

  const [results, total, statusCounts] = await Promise.all([
    (db.clipperApplication as any).findMany({
      where,
      select: {
        id: true, status: true, autoScore: true, autoDecision: true,
        reviewedAt: true, reviewNotes: true, rejectionReason: true, createdAt: true,
        clipperProfile: {
          select: {
            id: true, fullName: true, artisticName: true,
            verificationStatus: true, niches: true,
            user: { select: { imageUrl: true, subscriptionTier: true } },
          },
        },
        _count: { select: { clipPosts: true } },
      },
      orderBy: orderMap[args.sortBy as string] || { createdAt: "desc" },
      take: limit,
    }),
    (db.clipperApplication as any).count({ where: { campaignId: args.campaignId } }),
    (db.clipperApplication as any).groupBy({
      by: ["status"],
      where: { campaignId: args.campaignId },
      _count: true,
    }),
  ])

  return {
    _meta: { totalCount: total, returned: results.length, hasMore: total > results.length },
    data: serialize(results),
    funnel: serialize(statusCounts),
  }
}

// ── 8. Buscar clip posts ─────────────────────────────────────────────────────

async function toolSearchClipPosts(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = {}

  if (args.campaignId) where.campaignId = args.campaignId
  if (args.platform) where.platform = args.platform
  if (args.status) where.status = args.status
  if (args.username) where.username = { contains: args.username as string, mode: "insensitive" }
  if (args.minViews) where.views = { gte: args.minViews }

  const dateFilter = buildDateFilter(args.postedAfter as string, args.postedBefore as string)
  if (dateFilter) where.postedAt = dateFilter

  const orderMap: Record<string, unknown> = {
    views_desc: { views: "desc" },
    views_asc: { views: "asc" },
    likes_desc: { likes: "desc" },
    postedAt_desc: { postedAt: "desc" },
    postedAt_asc: { postedAt: "asc" },
    createdAt_desc: { createdAt: "desc" },
  }

  const results = await (db.clipPost as any).findMany({
    where,
    select: {
      id: true, platform: true, submittedUrl: true, username: true,
      caption: true, hashtags: true, mentions: true,
      views: true, likes: true, comments: true, shares: true,
      status: true, postedAt: true, createdAt: true, thumbnailUrl: true,
      campaign: { select: { id: true, name: true, slug: true } },
      application: {
        select: {
          clipperProfile: {
            select: { id: true, fullName: true, artisticName: true },
          },
        },
      },
    },
    orderBy: orderMap[args.sortBy as string] || { views: "desc" },
    take: limit,
  })

  const total = await (db.clipPost as any).count({ where })

  return {
    _meta: { totalCount: total, returned: results.length, hasMore: total > results.length },
    data: serialize(results),
  }
}

// ── 9. Detalhes completos de um clip + histórico de métricas ─────────────────

async function toolGetClipPostDetails(db: DB, args: Record<string, unknown>) {
  const clip = await (db.clipPost as any).findUnique({
    where: { id: args.clipPostId as string },
    include: {
      campaign: { select: { id: true, name: true, slug: true, status: true } },
      application: {
        select: {
          id: true, status: true,
          clipperProfile: {
            select: {
              id: true, fullName: true, artisticName: true,
              user: { select: { imageUrl: true } },
            },
          },
        },
      },
      metrics: {
        select: {
          collectedAt: true, views: true, likes: true, comments: true,
          shares: true, engagementRate: true, velocity24h: true,
          viewsDelta: true, likesDelta: true,
        },
        orderBy: { collectedAt: "desc" },
        take: 30,
      },
      fraudFlags: {
        select: {
          id: true, type: true, severity: true, status: true,
          message: true, createdAt: true,
        },
      },
      dailyRankingEntries: {
        select: {
          position: true, dailyViews: true, dailyRankingScore: true,
          dailyPrizeAmount: true, dailyPrizeStatus: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      },
    },
  })

  if (!clip) return { data: null, _meta: { error: "Clip não encontrado" } }
  return { data: serialize(clip) }
}

// ── 10. Top clips por performance ────────────────────────────────────────────

async function toolGetTopClips(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 10, 50)
  const where: Record<string, unknown> = { status: "ELIGIBLE" }

  if (args.campaignId) where.campaignId = args.campaignId
  if (args.platform) where.platform = args.platform

  const dateFilter = buildDateFilter(args.postedAfter as string, args.postedBefore as string)
  if (dateFilter) where.postedAt = dateFilter

  const metricMap: Record<string, unknown> = {
    views: { views: "desc" },
    likes: { likes: "desc" },
    comments: { comments: "desc" },
    shares: { shares: "desc" },
  }

  const results = await (db.clipPost as any).findMany({
    where,
    select: {
      id: true, platform: true, submittedUrl: true, username: true,
      caption: true, views: true, likes: true, comments: true, shares: true,
      postedAt: true, thumbnailUrl: true,
      campaign: { select: { id: true, name: true, slug: true } },
      application: {
        select: {
          clipperProfile: { select: { id: true, fullName: true, artisticName: true } },
        },
      },
    },
    orderBy: metricMap[args.metric as string] || { views: "desc" },
    take: limit,
  })

  return { _meta: { returned: results.length }, data: serialize(results) }
}

// ── 11. Visão geral financeira ───────────────────────────────────────────────

async function toolGetFinancialOverview(db: DB) {
  const [walletAgg, transactionsByType, transactionsByStatus, recentWithdrawals] =
    await Promise.all([
      (db.wallet as any).aggregate({
        _sum: { balance: true, totalEarned: true, totalWithdrawn: true, pendingWithdraw: true },
        _count: true,
      }),
      (db.transaction as any).groupBy({
        by: ["type"],
        _count: true,
        _sum: { amount: true },
      }),
      (db.transaction as any).groupBy({
        by: ["status"],
        _count: true,
        _sum: { amount: true },
      }),
      (db.transaction as any).findMany({
        where: { type: { startsWith: "WITHDRAWAL" } },
        select: {
          id: true, type: true, status: true, amount: true, createdAt: true,
          wallet: {
            select: {
              clipperProfile: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ])

  return {
    data: serialize({
      wallets: walletAgg,
      transactionsByType,
      transactionsByStatus,
      recentWithdrawals,
    }),
  }
}

// ── 12. Buscar transações ────────────────────────────────────────────────────

async function toolSearchTransactions(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = {}

  if (args.type) where.type = args.type
  if (args.status) where.status = args.status
  if (args.clipperProfileId) where.wallet = { clipperProfileId: args.clipperProfileId }

  const dateFilter = buildDateFilter(args.createdAfter as string, args.createdBefore as string)
  if (dateFilter) where.createdAt = dateFilter

  const orderMap: Record<string, unknown> = {
    createdAt_desc: { createdAt: "desc" },
    createdAt_asc: { createdAt: "asc" },
    amount_desc: { amount: "desc" },
    amount_asc: { amount: "asc" },
  }

  const results = await (db.transaction as any).findMany({
    where,
    select: {
      id: true, type: true, status: true, amount: true,
      balanceBefore: true, balanceAfter: true, currency: true,
      description: true, campaignId: true, rankingPosition: true,
      withdrawalMethod: true, processedAt: true, createdAt: true,
      wallet: {
        select: {
          clipperProfile: { select: { id: true, fullName: true } },
        },
      },
    },
    orderBy: orderMap[args.sortBy as string] || { createdAt: "desc" },
    take: limit,
  })

  const total = await (db.transaction as any).count({ where })

  return {
    _meta: { totalCount: total, returned: results.length, hasMore: total > results.length },
    data: serialize(results),
  }
}

// ── 13. Estatísticas gerais da plataforma ────────────────────────────────────

async function toolGetPlatformOverview(db: DB) {
  const [
    usersByRole, usersByTier, usersBySubStatus,
    clippersByVerification, campaignsByStatus,
    totalOrgs, totalClipPosts, totalApplications,
  ] = await Promise.all([
    (db.user as any).groupBy({ by: ["role"], _count: true }),
    (db.user as any).groupBy({ by: ["subscriptionTier"], _count: true }),
    (db.user as any).groupBy({ by: ["subscriptionStatus"], _count: true }),
    (db.clipperProfile as any).groupBy({ by: ["verificationStatus"], _count: true }),
    (db.campaign as any).groupBy({ by: ["status"], _count: true }),
    (db.organization as any).count(),
    (db.clipPost as any).count(),
    (db.clipperApplication as any).count(),
  ])

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [newUsersLast30d, newUsersLast7d, newClipsLast30d] = await Promise.all([
    (db.user as any).count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    (db.user as any).count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    (db.clipPost as any).count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ])

  return {
    data: serialize({
      usersByRole,
      usersByTier,
      usersBySubStatus,
      clippersByVerification,
      campaignsByStatus,
      totalOrganizations: totalOrgs,
      totalClipPosts,
      totalApplications,
      growth: { newUsersLast30d, newUsersLast7d, newClipsLast30d },
    }),
  }
}

// ── 14. Analytics do blog ────────────────────────────────────────────────────

async function toolGetBlogAnalytics(db: DB, args: Record<string, unknown>) {
  const periodMap: Record<string, number> = {
    "7d": 7, "30d": 30, "90d": 90, all: 99999,
  }
  const days = periodMap[args.period as string] || 30
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [
    postsByStatus, totalViews, topPosts,
    viewsByDevice, viewsByCountry, recentComments,
  ] = await Promise.all([
    (db.blogPost as any).groupBy({ by: ["status"], _count: true }),
    (db.blogPostView as any).count({ where: { viewedAt: { gte: since } } }),
    (db.blogPost as any).findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true, title: true, slug: true, viewsCount: true,
        likesCount: true, commentsCount: true, publishedAt: true,
      },
      orderBy: { viewsCount: "desc" },
      take: 10,
    }),
    (db.blogPostView as any).groupBy({
      by: ["device"],
      where: { viewedAt: { gte: since } },
      _count: true,
    }),
    (db.blogPostView as any).groupBy({
      by: ["country"],
      where: { viewedAt: { gte: since } },
      _count: true,
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
    (db.blogComment as any).findMany({
      select: {
        id: true, content: true, status: true, createdAt: true,
        author: { select: { name: true } },
        post: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  const postAgg = await (db.blogPost as any).aggregate({
    _sum: { viewsCount: true, likesCount: true, commentsCount: true, sharesCount: true },
    _count: true,
  })

  return {
    data: serialize({
      period: `${days}d`,
      postsByStatus,
      totalViewsInPeriod: totalViews,
      aggregates: postAgg,
      topPosts,
      viewsByDevice,
      viewsByCountry,
      recentComments,
    }),
  }
}

// ── 15. Buscar posts do blog ─────────────────────────────────────────────────

async function toolSearchBlogPosts(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = {}

  if (args.status) where.status = args.status
  if (args.categorySlug) where.category = { slug: args.categorySlug }
  if (args.query) {
    where.OR = [
      { title: { contains: args.query as string, mode: "insensitive" } },
      { content: { contains: args.query as string, mode: "insensitive" } },
    ]
  }

  const dateFilter = buildDateFilter(args.publishedAfter as string, args.publishedBefore as string)
  if (dateFilter) where.publishedAt = dateFilter

  const orderMap: Record<string, unknown> = {
    publishedAt_desc: { publishedAt: "desc" },
    publishedAt_asc: { publishedAt: "asc" },
    viewsCount_desc: { viewsCount: "desc" },
    likesCount_desc: { likesCount: "desc" },
  }

  const results = await (db.blogPost as any).findMany({
    where,
    select: {
      id: true, title: true, slug: true, excerpt: true,
      status: true, tags: true, viewsCount: true, likesCount: true,
      commentsCount: true, sharesCount: true, readTimeMinutes: true,
      publishedAt: true, createdAt: true,
      author: { select: { name: true, imageUrl: true } },
      category: { select: { title: true, slug: true, color: true } },
    },
    orderBy: orderMap[args.sortBy as string] || { publishedAt: "desc" },
    take: limit,
  })

  const total = await (db.blogPost as any).count({ where })

  return {
    _meta: { totalCount: total, returned: results.length, hasMore: total > results.length },
    data: serialize(results),
  }
}

// ── 16. Analytics da lista de interesse / leads ──────────────────────────────

async function toolGetLeadsAnalytics(db: DB) {
  const [byStatus, byUrgency, byBudget, byForWhom, recentLeads, total] =
    await Promise.all([
      (db.interestList as any).groupBy({ by: ["status"], _count: true }),
      (db.interestList as any).groupBy({ by: ["urgency"], _count: true }),
      (db.interestList as any).groupBy({ by: ["budget"], _count: true }),
      (db.interestList as any).groupBy({ by: ["forWhom"], _count: true }),
      (db.interestList as any).findMany({
        select: {
          id: true, fullName: true, email: true, status: true,
          urgency: true, budget: true, forWhom: true,
          instagramHandle: true, objectives: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      (db.interestList as any).count(),
    ])

  return {
    data: serialize({
      total,
      byStatus,
      byUrgency,
      byBudget,
      byForWhom,
      recentLeads,
    }),
  }
}

// ── 17. Flags de fraude ──────────────────────────────────────────────────────

async function toolGetFraudAlerts(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50)
  const where: Record<string, unknown> = {}

  if (args.campaignId) where.campaignId = args.campaignId
  if (args.status) where.status = args.status
  if (args.severity) where.severity = args.severity

  const [results, total, bySeverity, byType] = await Promise.all([
    (db.fraudFlag as any).findMany({
      where,
      select: {
        id: true, type: true, severity: true, status: true,
        message: true, createdAt: true,
        campaign: { select: { id: true, name: true, slug: true } },
        clipPost: {
          select: {
            id: true, platform: true, username: true, submittedUrl: true, views: true,
          },
        },
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    (db.fraudFlag as any).count({ where }),
    (db.fraudFlag as any).groupBy({ by: ["severity"], _count: true }),
    (db.fraudFlag as any).groupBy({ by: ["type"], _count: true }),
  ])

  return {
    _meta: { totalCount: total, returned: results.length },
    data: serialize(results),
    summary: serialize({ bySeverity, byType }),
  }
}

// ── 18. Log de auditoria ─────────────────────────────────────────────────────

async function toolGetAuditLog(db: DB, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 30, 100)
  const where: Record<string, unknown> = {}

  if (args.userId) where.userId = args.userId
  if (args.action) where.action = args.action
  if (args.entityType) where.entityType = args.entityType

  const dateFilter = buildDateFilter(args.createdAfter as string, args.createdBefore as string)
  if (dateFilter) where.createdAt = dateFilter

  const results = await (db.auditLog as any).findMany({
    where,
    select: {
      id: true, action: true, entityType: true, entityId: true,
      changes: true, createdAt: true,
      user: { select: { name: true, email: true } },
      campaign: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const total = await (db.auditLog as any).count({ where })

  return {
    _meta: { totalCount: total, returned: results.length },
    data: serialize(results),
  }
}

// ── 19. Detalhes de organização ──────────────────────────────────────────────

async function toolGetOrganizationDetails(db: DB, args: Record<string, unknown>) {
  const where: Record<string, unknown> = {}
  if (args.organizationId) where.id = args.organizationId
  else if (args.slug) where.slug = args.slug
  else return { data: null, _meta: { error: "Forneça organizationId ou slug" } }

  const org = await (db.organization as any).findFirst({
    where,
    include: {
      members: {
        select: {
          id: true, role: true, joinedAt: true,
          user: { select: { id: true, name: true, email: true, imageUrl: true } },
        },
      },
      campaigns: {
        select: {
          id: true, name: true, slug: true, status: true,
          startDate: true, endDate: true,
          _count: { select: { applications: true, clipPosts: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      quotaUsage: true,
      _count: { select: { campaigns: true, members: true } },
    },
  })

  if (!org) return { data: null, _meta: { error: "Organização não encontrada" } }
  return { data: serialize(org) }
}

// ── 20. Estatísticas da Academia Clipadora ───────────────────────────────────

async function toolGetAcademyStats(db: DB) {
  const [
    totalModules, totalLessons, publishedLessons,
    totalProgress, completedLessons, totalLikes,
    topLessons,
  ] = await Promise.all([
    (db.academyModule as any).count(),
    (db.academyLesson as any).count(),
    (db.academyLesson as any).count({ where: { isPublished: true } }),
    (db.academyLessonProgress as any).count(),
    (db.academyLessonProgress as any).count({ where: { completed: true } }),
    (db.academyLessonLike as any).count(),
    (db.academyLesson as any).findMany({
      select: {
        id: true, title: true, slug: true, duration: true, isFree: true,
        module: { select: { title: true } },
        _count: { select: { progress: true, likes: true } },
      },
      orderBy: { likes: { _count: "desc" } },
      take: 10,
    }),
  ])

  const completionRate = totalProgress > 0
    ? ((completedLessons / totalProgress) * 100).toFixed(1)
    : "0"

  return {
    data: serialize({
      totalModules,
      totalLessons,
      publishedLessons,
      totalProgress,
      completedLessons,
      totalLikes,
      completionRate: `${completionRate}%`,
      topLessonsByLikes: topLessons,
    }),
  }
}

// ── 21. Performance detalhada de clipador em cada competição ──────────────────

async function toolGetClipperCompetitionStats(db: DB, args: Record<string, unknown>) {
  const clipperProfileId = args.clipperProfileId as string

  const appWhere: Record<string, unknown> = {
    clipperProfileId,
    status: "APPROVED",
  }
  if (args.campaignId) appWhere.campaignId = args.campaignId

  const applications = await (db.clipperApplication as any).findMany({
    where: appWhere,
    select: {
      id: true,
      campaignId: true,
      createdAt: true,
      campaign: {
        select: {
          id: true, name: true, slug: true, status: true,
          startDate: true, endDate: true, platforms: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!applications.length) {
    return { data: [], _meta: { error: "Clipador não tem inscrições aprovadas" } }
  }

  const campaignStats = await Promise.all(
    applications.map(async (app: any) => {
      const [posts, monthlyEntries, dailyPrizes] = await Promise.all([
        (db.clipPost as any).findMany({
          where: { applicationId: app.id, status: "ELIGIBLE" },
          select: {
            id: true, platform: true, views: true, likes: true,
            comments: true, shares: true, saves: true, postedAt: true,
            submittedUrl: true, username: true, caption: true,
            hasRequiredHashtags: true, hasRequiredMentions: true,
            thumbnailUrl: true,
          },
          orderBy: { views: "desc" },
        }),
        (db.monthlyRankingEntry as any).findMany({
          where: { applicationId: app.id },
          select: {
            position: true, previousPosition: true, totalViews: true,
            totalLikes: true, totalComments: true, totalShares: true,
            rankingScore: true, postsCount: true, averageViewsPerPost: true,
            bestPostViews: true, engagementRate: true, prizeAmount: true,
            prizeStatus: true, videosOver100k: true, videosOver500k: true,
            monthlyRanking: { select: { monthPeriod: true, totalParticipants: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        (db.dailyRankingEntry as any).aggregate({
          where: { applicationId: app.id },
          _sum: { dailyPrizeAmount: true, bonusAmount: true },
          _count: true,
          _min: { position: true },
          _avg: { position: true, dailyViews: true },
        }),
      ])

      const totalViews = posts.reduce((sum: number, p: any) => sum + Number(p.views), 0)
      const totalLikes = posts.reduce((sum: number, p: any) => sum + p.likes, 0)
      const totalComments = posts.reduce((sum: number, p: any) => sum + p.comments, 0)
      const totalShares = posts.reduce((sum: number, p: any) => sum + p.shares, 0)
      const totalSaves = posts.reduce((sum: number, p: any) => sum + (p.saves || 0), 0)
      const totalPosts = posts.length

      const postDates = posts
        .map((p: any) => p.postedAt)
        .filter(Boolean)
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())
      const firstPostDate = postDates[0] || null
      const lastPostDate = postDates[postDates.length - 1] || null

      let daysActive = 0
      let avgPostsPerDay = 0
      if (firstPostDate && lastPostDate) {
        daysActive = Math.max(1, Math.ceil(
          (lastPostDate.getTime() - firstPostDate.getTime()) / (1000 * 60 * 60 * 24),
        ))
        avgPostsPerDay = Number((totalPosts / daysActive).toFixed(2))
      }

      const platformBreakdown: Record<string, { views: number; posts: number; likes: number }> = {}
      for (const p of posts) {
        const plat = p.platform as string
        if (!platformBreakdown[plat]) platformBreakdown[plat] = { views: 0, posts: 0, likes: 0 }
        platformBreakdown[plat]!.views += Number(p.views)
        platformBreakdown[plat]!.posts += 1
        platformBreakdown[plat]!.likes += p.likes
      }

      const hashtagCompliance = posts.filter((p: any) => p.hasRequiredHashtags === true).length
      const mentionCompliance = posts.filter((p: any) => p.hasRequiredMentions === true).length

      const monthlyPrizesTotal = monthlyEntries.reduce(
        (sum: number, e: any) => sum + (e.prizeAmount || 0), 0,
      )
      const dailyPrizesTotal = Number(dailyPrizes._sum?.dailyPrizeAmount || 0)
      const bonusTotal = Number(dailyPrizes._sum?.bonusAmount || 0)

      const videosOver100k = posts.filter((p: any) => Number(p.views) >= 100_000).length
      const videosOver500k = posts.filter((p: any) => Number(p.views) >= 500_000).length
      const videosOver1M = posts.filter((p: any) => Number(p.views) >= 1_000_000).length

      return {
        campaign: app.campaign,
        applicationId: app.id,
        appliedAt: app.createdAt,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
        totalPosts,
        avgViewsPerPost: totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0,
        daysActive,
        avgPostsPerDay,
        firstPostDate,
        lastPostDate,
        bestPost: posts[0] ? {
          views: Number(posts[0].views),
          likes: posts[0].likes,
          url: posts[0].submittedUrl,
          platform: posts[0].platform,
          postedAt: posts[0].postedAt,
        } : null,
        worstPost: totalPosts > 1 ? {
          views: Number(posts[totalPosts - 1].views),
          url: posts[totalPosts - 1].submittedUrl,
          platform: posts[totalPosts - 1].platform,
        } : null,
        platformBreakdown,
        hashtagCompliance: { compliant: hashtagCompliance, total: totalPosts },
        mentionCompliance: { compliant: mentionCompliance, total: totalPosts },
        engagementRate: calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves
        ),
        videosOver100k,
        videosOver500k,
        videosOver1M,
        prizes: {
          monthly: monthlyPrizesTotal,
          daily: dailyPrizesTotal,
          bonus: bonusTotal,
          total: monthlyPrizesTotal + dailyPrizesTotal + bonusTotal,
        },
        rankingHistory: monthlyEntries.map((e: any) => ({
          period: e.monthlyRanking?.monthPeriod,
          position: e.position,
          previousPosition: e.previousPosition,
          totalParticipants: e.monthlyRanking?.totalParticipants,
          score: e.rankingScore,
          prizeAmount: e.prizeAmount,
        })),
        dailyRankingSummary: {
          totalEntries: dailyPrizes._count,
          bestPosition: dailyPrizes._min?.position,
          avgPosition: dailyPrizes._avg?.position
            ? Number(Number(dailyPrizes._avg.position).toFixed(1))
            : null,
          avgDailyViews: dailyPrizes._avg?.dailyViews
            ? Number(Number(dailyPrizes._avg.dailyViews).toFixed(0))
            : null,
        },
      }
    }),
  )

  const grandTotal = {
    totalCampaigns: campaignStats.length,
    totalViews: campaignStats.reduce((s, c) => s + c.totalViews, 0),
    totalPosts: campaignStats.reduce((s, c) => s + c.totalPosts, 0),
    totalPrizes: campaignStats.reduce((s, c) => s + c.prizes.total, 0),
    avgViewsPerPost: 0,
    totalVideosOver100k: campaignStats.reduce((s, c) => s + c.videosOver100k, 0),
    totalVideosOver500k: campaignStats.reduce((s, c) => s + c.videosOver500k, 0),
    totalVideosOver1M: campaignStats.reduce((s, c) => s + c.videosOver1M, 0),
  }
  grandTotal.avgViewsPerPost = grandTotal.totalPosts > 0
    ? Math.round(grandTotal.totalViews / grandTotal.totalPosts) : 0

  return {
    _meta: { clipperProfileId, campaignsReturned: campaignStats.length },
    grandTotal: serialize(grandTotal),
    campaigns: serialize(campaignStats),
  }
}

// ── 22. Breakdown de performance por clipador em uma campanha ─────────────────

async function toolGetCampaignClipperBreakdown(db: DB, args: Record<string, unknown>) {
  const campaignId = args.campaignId as string
  const limit = Math.min(Number(args.limit) || 30, 100)
  const minPosts = Number(args.minPosts) || 0

  const applications = await (db.clipperApplication as any).findMany({
    where: { campaignId, status: "APPROVED" },
    select: {
      id: true,
      clipperProfile: {
        select: {
          id: true, fullName: true, artisticName: true,
          niches: true, verificationStatus: true,
          user: { select: { imageUrl: true, subscriptionTier: true, createdAt: true } },
        },
      },
    },
  })

  const postWhere: Record<string, unknown> = { campaignId, status: "ELIGIBLE" }
  if (args.platform) postWhere.platform = args.platform

  const allPosts = await (db.clipPost as any).findMany({
    where: postWhere,
    select: {
      id: true, applicationId: true, platform: true,
      views: true, likes: true, comments: true, shares: true, saves: true,
      postedAt: true, submittedUrl: true, username: true,
      hasRequiredHashtags: true, hasRequiredMentions: true,
    },
  })

  const [monthlyEntries, dailyEntries] = await Promise.all([
    (db.monthlyRankingEntry as any).findMany({
      where: { monthlyRanking: { campaignId } },
      select: {
        applicationId: true, position: true, totalViews: true,
        prizeAmount: true, prizeStatus: true,
        monthlyRanking: { select: { monthPeriod: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    (db.dailyRankingEntry as any).groupBy({
      by: ["applicationId"],
      where: { dailyRanking: { campaignId } },
      _sum: { dailyPrizeAmount: true, bonusAmount: true },
      _count: true,
      _min: { position: true },
      _avg: { position: true },
    }),
  ])

  const postsByApp = new Map<string, any[]>()
  for (const p of allPosts) {
    const list = postsByApp.get(p.applicationId) || []
    list.push(p)
    postsByApp.set(p.applicationId, list)
  }

  const monthlyByApp = new Map<string, any[]>()
  for (const e of monthlyEntries) {
    const list = monthlyByApp.get(e.applicationId) || []
    list.push(e)
    monthlyByApp.set(e.applicationId, list)
  }

  const dailyByApp = new Map<string, any>()
  for (const e of dailyEntries) {
    dailyByApp.set(e.applicationId, e)
  }

  let clippers = applications.map((app: any) => {
    const posts = postsByApp.get(app.id) || []
    const monthly = monthlyByApp.get(app.id) || []
    const daily = dailyByApp.get(app.id)

    const totalViews = posts.reduce((s: number, p: any) => s + Number(p.views), 0)
    const totalLikes = posts.reduce((s: number, p: any) => s + p.likes, 0)
    const totalComments = posts.reduce((s: number, p: any) => s + p.comments, 0)
    const totalShares = posts.reduce((s: number, p: any) => s + p.shares, 0)
    const totalSaves = posts.reduce((s: number, p: any) => s + (p.saves || 0), 0)
    const totalPosts = posts.length

    const postDates = posts.map((p: any) => p.postedAt).filter(Boolean)
      .sort((a: Date, b: Date) => a.getTime() - b.getTime())
    let daysActive = 0
    let avgPostsPerDay = 0
    if (postDates.length >= 2) {
      daysActive = Math.max(1, Math.ceil(
        (postDates[postDates.length - 1].getTime() - postDates[0].getTime()) / (1000 * 60 * 60 * 24),
      ))
      avgPostsPerDay = Number((totalPosts / daysActive).toFixed(2))
    } else if (postDates.length === 1) {
      daysActive = 1
      avgPostsPerDay = totalPosts
    }

    const platforms: Record<string, { views: number; posts: number }> = {}
    for (const p of posts) {
      const pl = p.platform as string
      if (!platforms[pl]) platforms[pl] = { views: 0, posts: 0 }
      platforms[pl]!.views += Number(p.views)
      platforms[pl]!.posts += 1
    }

    const hashtagOk = posts.filter((p: any) => p.hasRequiredHashtags === true).length
    const mentionOk = posts.filter((p: any) => p.hasRequiredMentions === true).length
    const bestPost = posts.length > 0 ? posts.reduce((best: any, p: any) =>
      Number(p.views) > Number(best.views) ? p : best, posts[0]) : null

    const monthlyPrizes = monthly.reduce((s: number, e: any) => s + (e.prizeAmount || 0), 0)
    const dailyPrizes = Number(daily?._sum?.dailyPrizeAmount || 0)
    const bonusPrizes = Number(daily?._sum?.bonusAmount || 0)
    const totalPrizes = monthlyPrizes + dailyPrizes + bonusPrizes

    const latestRanking = monthly.length > 0 ? monthly[0] : null
    const engagementRate = calculateEngagementRate(
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves
    )

    return {
      clipperProfileId: app.clipperProfile.id,
      fullName: app.clipperProfile.fullName,
      artisticName: app.clipperProfile.artisticName,
      imageUrl: app.clipperProfile.user?.imageUrl,
      subscriptionTier: app.clipperProfile.user?.subscriptionTier,
      verificationStatus: app.clipperProfile.verificationStatus,
      niches: app.clipperProfile.niches,
      memberSince: app.clipperProfile.user?.createdAt,
      applicationId: app.id,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalPosts,
      avgViewsPerPost: totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0,
      daysActive,
      avgPostsPerDay,
      engagementRate,
      platforms,
      compliance: {
        hashtags: `${hashtagOk}/${totalPosts}`,
        mentions: `${mentionOk}/${totalPosts}`,
      },
      bestPost: bestPost ? {
        views: Number(bestPost.views),
        url: bestPost.submittedUrl,
        platform: bestPost.platform,
        postedAt: bestPost.postedAt,
      } : null,
      videosOver100k: posts.filter((p: any) => Number(p.views) >= 100_000).length,
      videosOver500k: posts.filter((p: any) => Number(p.views) >= 500_000).length,
      prizes: { monthly: monthlyPrizes, daily: dailyPrizes, bonus: bonusPrizes, total: totalPrizes },
      currentRanking: latestRanking ? {
        position: latestRanking.position,
        period: latestRanking.monthlyRanking?.monthPeriod,
      } : null,
      dailyRanking: daily ? {
        totalEntries: daily._count,
        bestPosition: daily._min?.position,
        avgPosition: daily._avg?.position
          ? Number(Number(daily._avg.position).toFixed(1)) : null,
      } : null,
    }
  })

  if (minPosts > 0) clippers = clippers.filter((c: any) => c.totalPosts >= minPosts)

  const sortMap: Record<string, (a: any, b: any) => number> = {
    views_desc: (a, b) => b.totalViews - a.totalViews,
    posts_desc: (a, b) => b.totalPosts - a.totalPosts,
    avgViews_desc: (a, b) => b.avgViewsPerPost - a.avgViewsPerPost,
    prizes_desc: (a, b) => b.prizes.total - a.prizes.total,
    engagement_desc: (a, b) => b.engagementRate - a.engagementRate,
    postsPerDay_desc: (a, b) => b.avgPostsPerDay - a.avgPostsPerDay,
  }
  const sortFn = sortMap[args.sortBy as string] || sortMap.views_desc!
  clippers.sort(sortFn)
  clippers = clippers.slice(0, limit)

  return {
    _meta: {
      campaignId,
      totalApprovedClippers: applications.length,
      clippersWithPosts: postsByApp.size,
      returned: clippers.length,
    },
    data: serialize(clippers),
  }
}

// ── 23. Análise detalhada de posts de um clipador ────────────────────────────

async function toolGetClipperPostsAnalysis(db: DB, args: Record<string, unknown>) {
  const clipperProfileId = args.clipperProfileId as string
  const limit = Math.min(Number(args.limit) || 50, 200)

  const appWhere: Record<string, unknown> = { clipperProfileId, status: "APPROVED" }
  if (args.campaignId) appWhere.campaignId = args.campaignId

  const apps = await (db.clipperApplication as any).findMany({
    where: appWhere,
    select: { id: true, campaignId: true, campaign: { select: { name: true, slug: true } } },
  })

  if (!apps.length) {
    return { data: [], _meta: { error: "Nenhuma inscrição aprovada encontrada" } }
  }

  const postWhere: Record<string, unknown> = {
    applicationId: { in: apps.map((a: any) => a.id) },
  }
  if (args.platform) postWhere.platform = args.platform

  const orderMap: Record<string, unknown> = {
    views_desc: { views: "desc" },
    views_asc: { views: "asc" },
    postedAt_desc: { postedAt: "desc" },
    postedAt_asc: { postedAt: "asc" },
    likes_desc: { likes: "desc" },
    engagement_desc: { likes: "desc" },
  }

  const posts = await (db.clipPost as any).findMany({
    where: postWhere,
    select: {
      id: true, platform: true, submittedUrl: true, username: true,
      caption: true, hashtags: true, mentions: true,
      views: true, likes: true, comments: true, shares: true, saves: true,
      status: true, postedAt: true, createdAt: true, thumbnailUrl: true,
      hasRequiredHashtags: true, hasRequiredMentions: true,
      duration: true, applicationId: true,
      campaign: { select: { id: true, name: true, slug: true } },
    },
    orderBy: orderMap[args.sortBy as string] || { views: "desc" },
    take: limit,
  })

  const totalViews = posts.reduce((s: number, p: any) => s + Number(p.views), 0)
  const totalLikes = posts.reduce((s: number, p: any) => s + p.likes, 0)
  const totalComments = posts.reduce((s: number, p: any) => s + p.comments, 0)
  const totalShares = posts.reduce((s: number, p: any) => s + p.shares, 0)
  const totalSaves = posts.reduce((s: number, p: any) => s + (p.saves || 0), 0)

  const platformStats: Record<string, {
    views: number; posts: number; likes: number; avgViews: number
  }> = {}
  for (const p of posts) {
    const pl = p.platform as string
    if (!platformStats[pl]) platformStats[pl] = { views: 0, posts: 0, likes: 0, avgViews: 0 }
    platformStats[pl]!.views += Number(p.views)
    platformStats[pl]!.posts += 1
    platformStats[pl]!.likes += p.likes
  }
  for (const pl of Object.keys(platformStats)) {
    platformStats[pl]!.avgViews = Math.round(platformStats[pl]!.views / platformStats[pl]!.posts)
  }

  const postDates = posts.map((p: any) => p.postedAt).filter(Boolean)
    .sort((a: Date, b: Date) => a.getTime() - b.getTime())

  let daysActive = 0
  let avgPostsPerDay = 0
  let avgPostsPerWeek = 0
  const postsByDayOfWeek: Record<string, number> = {
    dom: 0, seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0,
  }
  const dayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]
  for (const d of postDates) {
    const dayName = dayNames[d.getDay()]!
    postsByDayOfWeek[dayName]! += 1
  }

  if (postDates.length >= 2) {
    daysActive = Math.max(1, Math.ceil(
      (postDates[postDates.length - 1].getTime() - postDates[0].getTime()) / (1000 * 60 * 60 * 24),
    ))
    avgPostsPerDay = Number((posts.length / daysActive).toFixed(2))
    avgPostsPerWeek = Number((posts.length / Math.max(1, daysActive / 7)).toFixed(2))
  } else if (postDates.length === 1) {
    daysActive = 1
    avgPostsPerDay = posts.length
    avgPostsPerWeek = posts.length
  }

  const hashtagOk = posts.filter((p: any) => p.hasRequiredHashtags === true).length
  const mentionOk = posts.filter((p: any) => p.hasRequiredMentions === true).length
  const eligible = posts.filter((p: any) => p.status === "ELIGIBLE").length

  const sortedByViews = [...posts].sort((a: any, b: any) => Number(b.views) - Number(a.views))

  return {
    _meta: { clipperProfileId, totalPosts: posts.length, totalPostsInDB: posts.length },
    summary: serialize({
      totalPosts: posts.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      avgViewsPerPost: posts.length > 0 ? Math.round(totalViews / posts.length) : 0,
      medianViews: posts.length > 0 ? Number(sortedByViews[Math.floor(sortedByViews.length / 2)]?.views || 0) : 0,
      engagementRate: calculateEngagementRate(
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves
      ),
      daysActive,
      avgPostsPerDay,
      avgPostsPerWeek,
      postsByDayOfWeek,
      compliance: {
        hashtags: `${hashtagOk}/${posts.length}`,
        mentions: `${mentionOk}/${posts.length}`,
        eligible: `${eligible}/${posts.length}`,
      },
      platformBreakdown: platformStats,
      bestPost: sortedByViews[0] ? {
        id: sortedByViews[0].id,
        views: Number(sortedByViews[0].views),
        likes: sortedByViews[0].likes,
        url: sortedByViews[0].submittedUrl,
        platform: sortedByViews[0].platform,
        postedAt: sortedByViews[0].postedAt,
      } : null,
      worstPost: sortedByViews.length > 1 ? {
        id: sortedByViews[sortedByViews.length - 1].id,
        views: Number(sortedByViews[sortedByViews.length - 1].views),
        url: sortedByViews[sortedByViews.length - 1].submittedUrl,
        platform: sortedByViews[sortedByViews.length - 1].platform,
      } : null,
    }),
    posts: serialize(posts.map((p: any) => ({
      id: p.id,
      platform: p.platform,
      url: p.submittedUrl,
      username: p.username,
      caption: p.caption?.substring(0, 120),
      views: Number(p.views),
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      status: p.status,
      postedAt: p.postedAt,
      duration: p.duration,
      hashtagsOk: p.hasRequiredHashtags,
      mentionsOk: p.hasRequiredMentions,
      campaign: p.campaign,
    }))),
  }
}

// ── 24. Resumo executivo de performance de campanha ──────────────────────────

async function toolGetCampaignPerformanceSummary(db: DB, args: Record<string, unknown>) {
  const where: Record<string, unknown> = {}
  if (args.campaignId) where.id = args.campaignId
  else if (args.slug) where.slug = args.slug
  else return { data: null, _meta: { error: "Forneça campaignId ou slug" } }

  const campaign = await (db.campaign as any).findFirst({
    where,
    select: {
      id: true, name: true, slug: true, status: true,
      startDate: true, endDate: true, platforms: true,
      rankingMetricType: true, requiredHashtags: true, requiredMentions: true,
      organization: { select: { name: true } },
    },
  })

  if (!campaign) return { data: null, _meta: { error: "Campanha não encontrada" } }

  const [
    appFunnel, postsByPlatform, postAgg, postsEligible,
    dailyViewsTrend, monthlyRankings, prizeAgg,
  ] = await Promise.all([
    (db.clipperApplication as any).groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: true,
    }),
    (db.clipPost as any).groupBy({
      by: ["platform"],
      where: { campaignId: campaign.id, status: "ELIGIBLE" },
      _count: true,
      _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
      _avg: { views: true },
    }),
    (db.clipPost as any).aggregate({
      where: { campaignId: campaign.id, status: "ELIGIBLE" },
      _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
      _count: true,
      _avg: { views: true, likes: true },
      _max: { views: true },
    }),
    (db.clipPost as any).count({
      where: { campaignId: campaign.id, status: "ELIGIBLE" },
    }),
    (db.dailyRanking as any).findMany({
      where: { campaignId: campaign.id },
      select: {
        rankingDate: true, totalPosts: true, totalDailyViews: true,
        totalClippers: true, averageViews: true,
      },
      orderBy: { rankingDate: "desc" },
      take: 30,
    }),
    (db.monthlyRanking as any).findMany({
      where: { campaignId: campaign.id },
      select: {
        monthPeriod: true, totalParticipants: true, totalPosts: true,
        totalViews: true, averageViews: true, calculatedAt: true,
      },
      orderBy: { windowStart: "desc" },
      take: 12,
    }),
    (db.monthlyRankingEntry as any).aggregate({
      where: { monthlyRanking: { campaignId: campaign.id }, prizeAmount: { gt: 0 } },
      _sum: { prizeAmount: true },
      _count: true,
      _avg: { prizeAmount: true },
      _max: { prizeAmount: true },
    }),
  ])

  const totalApps = appFunnel.reduce((s: number, f: any) => s + f._count, 0)
  const approvedApps = appFunnel.find((f: any) => f.status === "APPROVED")?._count || 0

  const uniqueClippersWithPosts = await (db.clipPost as any).findMany({
    where: { campaignId: campaign.id, status: "ELIGIBLE" },
    select: { applicationId: true },
    distinct: ["applicationId"],
  })

  const campaignDays = Math.max(1, Math.ceil(
    (new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24),
  ))
  const elapsedDays = Math.max(1, Math.ceil(
    (Date.now() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24),
  ))
  const daysForAvg = Math.min(campaignDays, elapsedDays)

  const dailyPrizesAgg = await (db.dailyRankingEntry as any).aggregate({
    where: { dailyRanking: { campaignId: campaign.id }, dailyPrizeAmount: { gt: 0 } },
    _sum: { dailyPrizeAmount: true, bonusAmount: true },
    _count: true,
  })

  return {
    data: serialize({
      campaign,
      overview: {
        totalViews: Number(postAgg._sum?.views || 0),
        totalPosts: postAgg._count || 0,
        totalEligiblePosts: postsEligible,
        uniqueClippersPosted: uniqueClippersWithPosts.length,
        maxViewsSinglePost: Number(postAgg._max?.views || 0),
        avgViewsPerPost: Number(postAgg._avg?.views || 0),
        avgLikesPerPost: Number(postAgg._avg?.likes || 0),
        avgPostsPerDay: Number((postsEligible / daysForAvg).toFixed(2)),
        avgPostsPerClipper: uniqueClippersWithPosts.length > 0
          ? Number((postsEligible / uniqueClippersWithPosts.length).toFixed(1)) : 0,
        campaignDuration: campaignDays,
        daysElapsed: elapsedDays,
      },
      funnel: {
        totalApplications: totalApps,
        approved: approvedApps,
        conversionRate: totalApps > 0
          ? `${((approvedApps / totalApps) * 100).toFixed(1)}%` : "0%",
        postedRate: approvedApps > 0
          ? `${((uniqueClippersWithPosts.length / approvedApps) * 100).toFixed(1)}%` : "0%",
        breakdown: appFunnel,
      },
      platformBreakdown: postsByPlatform.map((p: any) => ({
        platform: p.platform,
        posts: p._count,
        totalViews: Number(p._sum?.views || 0),
        totalLikes: Number(p._sum?.likes || 0),
        avgViews: Number(p._avg?.views || 0),
        shareOfViews: Number(postAgg._sum?.views || 0) > 0
          ? `${((Number(p._sum?.views || 0) / Number(postAgg._sum?.views || 1)) * 100).toFixed(1)}%`
          : "0%",
      })),
      engagement: {
        totalLikes: Number(postAgg._sum?.likes || 0),
        totalComments: Number(postAgg._sum?.comments || 0),
        totalShares: Number(postAgg._sum?.shares || 0),
        totalSaves: Number(postAgg._sum?.saves || 0),
        engagementRate: calculateEngagementRate(
          Number(postAgg._sum?.views || 0),
          Number(postAgg._sum?.likes || 0),
          Number(postAgg._sum?.comments || 0),
          Number(postAgg._sum?.shares || 0),
          Number(postAgg._sum?.saves || 0)
        ),
      },
      prizes: {
        monthlyTotal: Number(prizeAgg._sum?.prizeAmount || 0),
        monthlyCount: prizeAgg._count || 0,
        monthlyAvg: Number(prizeAgg._avg?.prizeAmount || 0),
        monthlyMax: Number(prizeAgg._max?.prizeAmount || 0),
        dailyTotal: Number(dailyPrizesAgg._sum?.dailyPrizeAmount || 0),
        bonusTotal: Number(dailyPrizesAgg._sum?.bonusAmount || 0),
        dailyCount: dailyPrizesAgg._count || 0,
        grandTotal: Number(prizeAgg._sum?.prizeAmount || 0) +
          Number(dailyPrizesAgg._sum?.dailyPrizeAmount || 0) +
          Number(dailyPrizesAgg._sum?.bonusAmount || 0),
      },
      dailyTrend: dailyViewsTrend.reverse(),
      monthlyHistory: monthlyRankings,
    }),
  }
}

// ── 25. Dynamic Query — AI constrói queries Prisma livremente ────────────────

const ALLOWED_MODELS = new Set([
  "user", "organization", "organizationMember", "campaign", "rankingRule",
  "clipperProfile", "clientProfile", "socialAccount", "clipperApplication",
  "applicationSocialAccount", "clipPost", "clipPostMetrics",
  "metricsExtractionFailure", "monthlyRanking", "monthlyRankingEntry",
  "dailyRanking", "dailyRankingEntry", "fraudFlag", "auditLog", "wallet",
  "transaction", "link", "notification", "interestList", "job", "kiwifySale",
  "academyModule", "academyLesson", "academyLessonProgress",
  "academyLessonLike", "tiktokConnection", "clipPostBucketVideo",
  "blogCategory", "blogPost", "blogComment", "blogPostLike",
  "blogCommentLike", "blogPostView", "webhookEndpoint", "webhookDelivery",
  "quotaUsage",
])

const ALLOWED_OPERATIONS = new Set([
  "findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy",
])

function convertDateStrings(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) return new Date(obj)
    return obj
  }
  if (typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(convertDateStrings)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = convertDateStrings(value)
  }
  return result
}

async function toolExecuteDynamicQuery(db: DB, args: Record<string, unknown>) {
  const model = args.model as string
  const operation = args.operation as string
  const queryArgs = (args.args ?? {}) as Record<string, unknown>

  if (!ALLOWED_MODELS.has(model)) {
    return { error: `Modelo "${model}" não é permitido. Modelos disponíveis: ${[...ALLOWED_MODELS].join(", ")}` }
  }

  if (!ALLOWED_OPERATIONS.has(operation)) {
    return { error: `Operação "${operation}" não é permitida. Apenas leitura: ${[...ALLOWED_OPERATIONS].join(", ")}` }
  }

  const prismaModel = (db as Record<string, any>)[model]
  if (!prismaModel) {
    return { error: `Modelo "${model}" não encontrado no Prisma Client. Verifique o nome (camelCase).` }
  }

  const prismaFn = prismaModel[operation]
  if (typeof prismaFn !== "function") {
    return { error: `Operação "${operation}" não disponível no modelo "${model}".` }
  }

  const processedArgs = convertDateStrings(queryArgs) as Record<string, unknown>

  if (operation === "findMany" && !processedArgs.take) {
    processedArgs.take = 100
  }
  if (operation === "findMany" && typeof processedArgs.take === "number") {
    processedArgs.take = Math.min(processedArgs.take, 200)
  }

  try {
    const result = await prismaFn.call(prismaModel, processedArgs)
    const safe = stripSensitiveDeep(serialize(result))

    const resultArray = Array.isArray(safe) ? safe : [safe]
    const resultCount = Array.isArray(safe) ? safe.length : 1

    return {
      _meta: {
        model,
        operation,
        resultCount,
        truncated: operation === "findMany" && resultCount >= (processedArgs.take as number || 100),
      },
      data: resultArray.length <= 1 ? (resultArray[0] ?? null) : resultArray,
    }
  } catch (err: any) {
    const msg = err.message || String(err)
    if (msg.includes("Unknown field") || msg.includes("Unknown arg")) {
      return { error: `Query inválida: ${msg.split("\n").slice(0, 3).join(" ")}. Verifique os campos/args contra o schema.` }
    }
    if (msg.includes("Invalid")) {
      return { error: `Argumento inválido: ${msg.split("\n").slice(0, 3).join(" ")}` }
    }
    return { error: `Erro na query dinâmica (${model}.${operation}): ${msg.slice(0, 300)}` }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL DISPATCHER — Mapeia nome da tool → executor
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeTool(
  db: DB,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    switch (name) {
      case "searchClippers":           return await toolSearchClippers(db, args)
      case "getClipperFullProfile":    return await toolGetClipperFullProfile(db, args)
      case "getClipperRankingHistory": return await toolGetClipperRankingHistory(db, args)
      case "searchCampaigns":          return await toolSearchCampaigns(db, args)
      case "getCampaignFullDetails":   return await toolGetCampaignFullDetails(db, args)
      case "getCampaignRanking":       return await toolGetCampaignRanking(db, args)
      case "getCampaignApplications":  return await toolGetCampaignApplications(db, args)
      case "searchClipPosts":          return await toolSearchClipPosts(db, args)
      case "getClipPostDetails":       return await toolGetClipPostDetails(db, args)
      case "getTopClips":              return await toolGetTopClips(db, args)
      case "getFinancialOverview":     return await toolGetFinancialOverview(db)
      case "searchTransactions":       return await toolSearchTransactions(db, args)
      case "getPlatformOverview":      return await toolGetPlatformOverview(db)
      case "getBlogAnalytics":         return await toolGetBlogAnalytics(db, args)
      case "searchBlogPosts":          return await toolSearchBlogPosts(db, args)
      case "getLeadsAnalytics":        return await toolGetLeadsAnalytics(db)
      case "getFraudAlerts":           return await toolGetFraudAlerts(db, args)
      case "getAuditLog":              return await toolGetAuditLog(db, args)
      case "getOrganizationDetails":   return await toolGetOrganizationDetails(db, args)
      case "getAcademyStats":          return await toolGetAcademyStats(db)
      case "getClipperCompetitionStats": return await toolGetClipperCompetitionStats(db, args)
      case "getCampaignClipperBreakdown": return await toolGetCampaignClipperBreakdown(db, args)
      case "getClipperPostsAnalysis":  return await toolGetClipperPostsAnalysis(db, args)
      case "getCampaignPerformanceSummary": return await toolGetCampaignPerformanceSummary(db, args)
      case "executeDynamicQuery":         return await toolExecuteDynamicQuery(db, args)
      default:
        return { error: `Ferramenta desconhecida: ${name}` }
    }
  } catch (err: any) {
    console.error(`[ClipfyAI] Erro ao executar tool "${name}":`, err)
    return { error: `Erro ao executar ${name}: ${err.message}` }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER — Endpoint principal do chat com agent loop
// ═══════════════════════════════════════════════════════════════════════════════

export const chatRouter = createTRPCRouter({
  // ── Enviar mensagem e obter resposta da IA com tool calling ─────────────────
  sendMessage: adminProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

        const MAX_ITERATIONS = 10

        const messages: any[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...input.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ]

        let iterationCount = 0
        let totalToolCalls = 0
        const toolsUsed: string[] = []

        // Phase 1: Tool-calling loop (no reasoning — not supported with tools)
        while (iterationCount < MAX_ITERATIONS) {
          iterationCount++

          const response = await openai.chat.completions.create({
            model: "gpt-5.4",
            messages,
            tools: TOOLS,
            temperature: 1,
            max_completion_tokens: 8192,
          })

          const choice = response.choices[0]
          if (!choice) {
            throw new Error("Nenhuma resposta da OpenAI")
          }

          const assistantMessage = choice.message

          if (
            !assistantMessage.tool_calls ||
            assistantMessage.tool_calls.length === 0
          ) {
            break
          }

          messages.push({
            ...assistantMessage,
            content: null,
          })

          for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.type !== "function") continue
            const fnName = toolCall.function.name
            const fnArgs = JSON.parse(toolCall.function.arguments)
            totalToolCalls++
            toolsUsed.push(fnName)

            console.log(`[ClipfyAI] Tool call #${totalToolCalls}: ${fnName}`, fnArgs)

            const result = await executeTool(ctx.db, fnName, fnArgs)

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            })
          }
        }

        // Phase 2: Final response with reasoning (no tools)
        const finalResponse = await openai.chat.completions.create({
          model: "gpt-5.4",
          messages,
          temperature: 1,
          max_completion_tokens: 16384,
          reasoning_effort: "high",
        })

        const finalContent =
          finalResponse.choices[0]?.message?.content ||
          "Desculpe, não consegui gerar uma resposta."

        return {
          content: finalContent,
          toolCalls: totalToolCalls,
          toolsUsed: [...new Set(toolsUsed)],
        }
      } catch (error: any) {
        console.error("[ClipfyAI] Erro no chat:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar mensagem com IA",
        })
      }
    }),
})
