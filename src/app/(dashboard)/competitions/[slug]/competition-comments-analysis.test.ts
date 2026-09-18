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
        emptyComments: 345,
        estimatedCostUsd: 1.234567,
        exceedsLimit: true,
      }),
    ).toEqual({
      loadedComments: 12_345,
      queuedComments: 12_000,
      ignoredComments: 345,
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
      loadedComments: 42,
      queuedComments: 42,
      ignoredComments: 0,
      estimatedCostUsd: 0.05,
      exceedsLimit: false,
    });
  });

  it("calcula ignorados quando a API não informa emptyComments", () => {
    expect(
      campaignAnalysisEstimateSummary({
        totalCommentsLoaded: 1_091,
        queuedComments: 832,
        estimatedCostUsd: 0.014201,
      }),
    ).toEqual({
      loadedComments: 1_091,
      queuedComments: 832,
      ignoredComments: 259,
      estimatedCostUsd: 0.014201,
      exceedsLimit: false,
    });
  });
});
