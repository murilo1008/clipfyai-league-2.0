import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/trpc/react", () => ({ api: {} }));
// O contador animado depende do provider de visibilidade financeira.
vi.mock("@/components/shared/count-up", () => ({
  CountUp: () => null,
  formatCompact: (value: number) => String(value),
}));

import {
  CommentsAnalysisResults,
  type CommentsAnalysisAggregateData,
} from "./comments-analysis-results-panel";

const staleAggregate: CommentsAnalysisAggregateData = {
  analyzedComments: 120,
  sentimentCounts: { positive: 80, neutral: 20, mixed: 10, negative: 10 },
  topPositivePoints: [],
  topCriticisms: [],
  topSuggestions: [],
  summary: "Resumo",
  publicPerception: "positive",
  generatedAt: "2026-10-20T12:00:00Z",
  newCommentsSinceGeneratedAt: 15,
  isStale: true,
};

function renderStale(canReanalyze?: boolean) {
  return renderToStaticMarkup(
    createElement(CommentsAnalysisResults, {
      scope: "campaign",
      aggregate: staleAggregate,
      comments: [],
      sentimentFilter: "all",
      onSentimentFilterChange: () => undefined,
      canReanalyze,
    }),
  );
}

describe("aviso de análise desatualizada", () => {
  it("pede uma nova análise a quem pode dispará-la (admin)", () => {
    const html = renderStale(true);
    expect(html).toContain("15 comentários novos");
    expect(html).toContain("Rode uma nova análise");
  });

  it("não pede ação a quem só lê o resultado (cliente e CS)", () => {
    const html = renderStale();
    expect(html).toContain("15 comentários novos");
    expect(html).not.toContain("Rode uma nova análise");
    expect(html).toContain("próxima análise da Clipfy League");
  });
});
