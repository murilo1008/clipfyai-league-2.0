import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_ANALYSIS_MAX_COMMENTS,
  campaignAnalysisEstimateSummary,
  campaignAnalysisInput,
} from "./competition-comments-analysis";

describe("competition comments analysis flow", () => {
  it("monta a primeira análise e a análise incremental sem reprocessar", () => {
    expect(campaignAnalysisInput("campaign-1", false)).toEqual({
      campaignId: "campaign-1",
      maxComments: CAMPAIGN_ANALYSIS_MAX_COMMENTS,
      forceReprocess: false,
    });
  });

  it("monta a reanálise completa com forceReprocess", () => {
    expect(campaignAnalysisInput("campaign-1", true)).toEqual({
      campaignId: "campaign-1",
      maxComments: CAMPAIGN_ANALYSIS_MAX_COMMENTS,
      forceReprocess: true,
    });
  });

  it("prepara quantidade, custo e bloqueio para a confirmação", () => {
    expect(
      campaignAnalysisEstimateSummary({
        totalCommentsLoaded: 12_345,
        queuedComments: 12_000,
        estimatedCostUsd: 1.234567,
        exceedsLimit: true,
      }),
    ).toEqual({
      comments: 12_345,
      estimatedCostUsd: 1.234567,
      exceedsLimit: true,
    });
  });

  it("usa comentários cobrados quando o total carregado não é informado", () => {
    expect(
      campaignAnalysisEstimateSummary({
        queuedComments: 42,
        estimatedCostUsd: "0.05",
      }),
    ).toEqual({
      comments: 42,
      estimatedCostUsd: 0.05,
      exceedsLimit: false,
    });
  });
});
