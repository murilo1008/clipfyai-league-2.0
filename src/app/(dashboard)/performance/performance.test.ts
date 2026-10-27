import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const performanceQuery = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/trpc/react", () => ({
  api: { customers: { getPerformance: { useQuery: performanceQuery } } },
}));
vi.mock("@/components/home/home-hero", () => ({ HomeHero: () => null }));
// Os gráficos carregam sob demanda (next/dynamic); no teste, o módulo que
// os expõe devolve marcadores síncronos.
vi.mock("./performance-charts", () => ({
  CpmComparisonChart: () =>
    createElement("div", { "data-testid": "cpm-chart" }),
  ProfileFollowersSparkline: () => null,
  VideoViewsSparkline: () => null,
}));

import ClientPerformance from "./performance";

function performance(
  effectiveCpm: number,
  referenceCpm = 10,
  historyCount = 2,
) {
  return {
    summary: {
      investedAmount: effectiveCpm * 10,
      totalViews: 10_000,
      effectiveCpm,
      referenceCpm,
      equivalentAdsCost: referenceCpm * 10,
      estimatedSavings: (referenceCpm - effectiveCpm) * 10,
    },
    cpmHistory: Array.from({ length: historyCount }, (_, index) => ({
      date: `2026-09-${String(29 + index).padStart(2, "0")}T12:00:00Z`,
      // O CPM anterior pode estar acima do mercado: vale o CPM atual.
      effectiveCpm: index === 0 ? 15 : effectiveCpm,
      referenceCpm,
      totalViews: 10_000,
      investment: effectiveCpm * 10,
      estimatedAdsCost: referenceCpm * 10,
    })),
    profiles: [],
    videos: [],
  };
}

function renderPerformance(selected = performance(8), overall = selected) {
  performanceQuery.mockReturnValue({
    data: {
      campaigns: [
        { id: "campaign-1", name: "Competição 1" },
        ...(overall !== selected
          ? [{ id: "campaign-2", name: "Competição 2" }]
          : []),
      ],
      selected,
      overall,
    },
    isLoading: false,
    isError: false,
  });
  return renderToStaticMarkup(createElement(ClientPerformance));
}

describe("gráfico de CPM na performance do cliente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra o gráfico quando o CPM atual está abaixo da média de mercado", () => {
    expect(renderPerformance()).toContain('data-testid="cpm-chart"');
  });

  it.each([10, 12])(
    "oculta o gráfico com CPM %s igual ou acima da média, mantendo os indicadores",
    (effectiveCpm) => {
      const html = renderPerformance(performance(effectiveCpm));
      expect(html).not.toContain('data-testid="cpm-chart"');
      expect(html).toContain("CPM efetivo");
      expect(html).not.toContain("Ainda não há histórico suficiente");
      // A comparação com o mercado segue a regra do gráfico.
      expect(html).not.toContain("Acima do mercado");
      expect(html).not.toContain("Economia estimada");
      expect(html).not.toContain("Diferença estimada");
    },
  );

  it.each([0, 1])(
    "aguarda histórico com apenas %s pontos mesmo quando o CPM é menor",
    (historyCount) => {
      const html = renderPerformance(performance(8, 10, historyCount));
      expect(html).not.toContain('data-testid="cpm-chart"');
      expect(html).toContain("Ainda não há histórico suficiente");
      expect(html).toContain("Economia estimada");
    },
  );

  it("oculta o gráfico sem visualizações", () => {
    const selected = performance(8);
    selected.summary.totalViews = 0;
    expect(renderPerformance(selected)).not.toContain(
      'data-testid="cpm-chart"',
    );
  });

  it("oculta o gráfico sem CPM médio de mercado", () => {
    expect(renderPerformance(performance(8, 0))).not.toContain(
      'data-testid="cpm-chart"',
    );
  });

  it.each([8, 12])(
    "usa o CPM consolidado %s na visão geral em vez do CPM da primeira competição",
    (overallCpm) => {
      const html = renderPerformance(performance(8), performance(overallCpm));
      expect(html.includes('data-testid="cpm-chart"')).toBe(overallCpm < 10);
    },
  );
});
