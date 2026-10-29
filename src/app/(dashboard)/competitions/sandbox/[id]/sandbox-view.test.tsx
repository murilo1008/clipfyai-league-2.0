import type * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { FinancialVisibilityProvider } from "@/contexts/financial-visibility-context"
import { sandboxDataSchema, type SandboxData } from "@/lib/competition-sandbox"
import { buildSandboxSnapshot } from "@/server/competition-sandbox-snapshot"

import {
  AccountsRankingForm,
  CampaignForm,
  GrowthForm,
  MonthlyRankingForm,
  PlatformDistributionForm,
  PrizesForm,
  StatsForm,
  TopPostsForm,
} from "./sandbox-forms"
import {
  SandboxAccountsRanking,
  SandboxHero,
  SandboxKpis,
  SandboxMonthlyRanking,
  SandboxOverview,
  SandboxTopPosts,
} from "./sandbox-view"

vi.mock("@/trpc/react", () => ({ api: {} }))

function snapshot(): SandboxData {
  return sandboxDataSchema.parse(
    buildSandboxSnapshot({
      details: {
        campaign: {
          name: "Belli - Outubro",
          description: "Cortes oficiais",
          coverImageUrl: "https://utfs.io/f/capa.png",
          status: "ACTIVE",
          startDate: "2026-10-01T03:00:00.000Z",
          endDate: "2026-10-31T02:59:59.000Z",
          platforms: ["TIKTOK", "INSTAGRAM"],
          requiredHashtags: ["belli"],
          requiredMentions: ["belli.oficial"],
          totalPrize: "10000",
          isPrivate: true,
          isProOnly: false,
          rankingMetricType: "VIEWS_X_ENGAGEMENT",
        },
        stats: {
          totalViews: 1_000_000,
          totalLikes: 50_000,
          totalComments: 2_000,
          totalShares: 1_000,
          totalSaves: 500,
          totalClippers: 40,
          totalPosts: 320,
          engagementRate: 5.35,
        },
        topMonthlyRanking: [
          {
            position: 1,
            clipperName: "Ana",
            clipperUsername: "ana.cortes",
            clipperImageUrl: null,
            clanTag: "ALFA",
            totalViews: 400_000,
            totalLikes: 20_000,
            totalComments: 800,
            totalShares: 300,
            totalSaves: 100,
            postsCount: 30,
            engagementRate: 5.3,
          },
        ],
        topAccountsRanking: [
          {
            username: "ana.cortes",
            platform: "TIKTOK",
            totalViews: 400_000,
            totalLikes: 20_000,
            totalComments: 800,
            totalShares: 300,
            totalSaves: 200,
            postsCount: 30,
            engagementRate: 5.3,
          },
        ],
        topPostsForReport: [
          {
            id: "post-1",
            url: "https://tiktok.com/@ana/video/1",
            platform: "TIKTOK",
            username: "ana.cortes",
            clipperName: "Ana",
            views: 120_000,
            likes: 6_000,
            comments: 100,
            shares: 40,
            postedAt: "2026-10-05T01:30:00.000Z",
          },
        ],
        rankingRule: {
          dailyEnabled: true,
          dailyTopCount: 15,
          dailyTotalPrize: 1000,
          monthlyEnabled: true,
          monthlyTopCount: 10,
          monthlyTotalPrize: 20_000,
          monthlyPrizeTable: { "1": 5000 },
          bonusEnabled: false,
          bonusMilestone: 1_000_000,
          bonusAmount: 100,
        },
      },
      charts: {
        platformDistribution: [
          {
            platform: "TIKTOK",
            posts: 200,
            views: 700_000,
            likes: 35_000,
            comments: 1_500,
            shares: 800,
            saves: 300,
          },
        ],
        platformGrowthData: [
          { date: "2026-10-01", total: 100_000, TIKTOK: 100_000 },
          { date: "2026-10-02", total: 700_000, TIKTOK: 700_000 },
        ],
        growthPlatforms: ["TIKTOK"],
      },
    }),
  )
}

function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <FinancialVisibilityProvider>{node}</FinancialVisibilityProvider>,
  )
}

describe("visualização do sandbox", () => {
  it("monta o cabeçalho com os dados editados", () => {
    const data = snapshot()
    const markup = render(<SandboxHero campaign={data.campaign} />)

    expect(markup).toContain("Belli - Outubro")
    expect(markup).toContain("01 de outubro de 2026")
    expect(markup).toContain("30 de outubro de 2026")
    expect(markup).toContain("Privada")
    expect(markup).toContain("Views × Engajamento")
    expect(markup).toContain("#belli")
    expect(markup).toContain("@belli.oficial")
    expect(markup).toContain("https://utfs.io/f/capa.png")
  })

  it("renderiza KPIs, gráficos, rankings e posts sem erros", () => {
    const data = snapshot()
    const markup = render(
      <>
        <SandboxKpis stats={data.stats} />
        <SandboxOverview data={data} />
        <SandboxMonthlyRanking data={data} />
        <SandboxAccountsRanking data={data} />
        <SandboxTopPosts data={data} />
      </>,
    )

    expect(markup).toContain("Distribuição por Plataforma")
    expect(markup).toContain("Crescimento de Views")
    expect(markup).toContain("Premiação Diária")
    expect(markup).toContain("Ranking Mensal Geral da Competição")
    expect(markup).toContain("[ALFA]")
    expect(markup).toContain("Total em Premiação Mensal")
    expect(markup).toContain("@ana.cortes")
    expect(markup).toContain("04/10/2026")
    expect(markup).toContain("https://tiktok.com/@ana/video/1")
  })

  it("usa a thumbnail atual do post de origem quando a do sandbox está vazia", () => {
    const data = snapshot()
    expect(data.topPosts[0]).toMatchObject({
      sourcePostId: "post-1",
      thumbnailUrl: "",
    })

    const live = render(
      <SandboxTopPosts
        data={data}
        liveThumbnails={{ "post-1": "https://cdn.example.com/atual.jpg" }}
      />,
    )
    expect(live).toContain("https://cdn.example.com/atual.jpg")

    // URL digitada no sandbox vence a do post
    const edited = render(
      <SandboxTopPosts
        data={{
          ...data,
          topPosts: [
            {
              ...data.topPosts[0]!,
              thumbnailUrl: "https://utfs.io/f/mine.png",
            },
          ],
        }}
        liveThumbnails={{ "post-1": "https://cdn.example.com/atual.jpg" }}
      />,
    )
    expect(edited).toContain("https://utfs.io/f/mine.png")
    expect(edited).not.toContain("atual.jpg")
  })

  it("mostra os estados vazios da página real, sem pista de sandbox", () => {
    const data: SandboxData = {
      ...snapshot(),
      platformDistribution: [],
      growth: [],
      monthlyRanking: [],
      accountsRanking: [],
      topPosts: [],
    }
    const markup = render(
      <>
        <SandboxOverview data={data} />
        <SandboxMonthlyRanking data={data} />
        <SandboxAccountsRanking data={data} />
        <SandboxTopPosts data={data} />
      </>,
    )

    expect(markup).not.toMatch(/modo edição|sandbox/i)
    // Sem dados, a página real só omite os gráficos
    expect(markup).not.toContain("Sem dados para os gráficos")
    expect(markup).toContain("Nenhum clipper no ranking ainda")
    expect(markup).toContain("Nenhuma conta no ranking")
    expect(markup).toContain("Nenhum post")
  })
})

describe("edição do sandbox", () => {
  it("renderiza todos os formulários com os valores importados", () => {
    const data = snapshot()
    const noop = () => undefined
    const markup = render(
      <>
        <CampaignForm campaign={data.campaign} onChange={noop} />
        <StatsForm stats={data.stats} onChange={noop} />
        <PrizesForm prizes={data.prizes} onChange={noop} />
        <PlatformDistributionForm
          rows={data.platformDistribution}
          onChange={noop}
        />
        <GrowthForm
          growth={data.growth}
          growthPlatforms={data.growthPlatforms}
          platformDistribution={data.platformDistribution}
          startDate={data.campaign.startDate}
          endDate={data.campaign.endDate}
          targetTotal={data.stats.totalViews}
          onChange={noop}
        />
        <MonthlyRankingForm
          rows={data.monthlyRanking}
          metricType={data.campaign.rankingMetricType}
          onChange={noop}
        />
        <AccountsRankingForm
          rows={data.accountsRanking}
          metricType={data.campaign.rankingMetricType}
          onChange={noop}
        />
        <TopPostsForm rows={data.topPosts} onChange={noop} />
      </>,
    )

    expect(markup).toContain('value="Belli - Outubro"')
    expect(markup).toContain('value="2026-10-01"')
    expect(markup).toContain('value="belli"')
    // Números com separador pt-BR
    expect(markup).toContain('value="1.000.000"')
    expect(markup).toContain('value="5,35"')
    expect(markup).toContain('value="5.000"')
    expect(markup).toContain("Ordenar por score")
    // ER segue o formato do resto do painel (toFixed)
    expect(markup).toContain("Recalcular engajamento (5.35%)")
  })
})
