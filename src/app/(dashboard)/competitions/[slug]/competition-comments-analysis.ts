export const CAMPAIGN_ANALYSIS_MAX_COMMENTS = 30_000;

export interface CampaignAnalysisInput {
  campaignId: string;
  maxComments: number;
  forceReprocess: boolean;
}

export interface CampaignAnalysisEstimateSummary {
  comments: number;
  estimatedCostUsd: number;
  exceedsLimit: boolean;
}

export function campaignAnalysisInput(
  campaignId: string,
  forceReprocess: boolean,
): CampaignAnalysisInput {
  return {
    campaignId,
    maxComments: CAMPAIGN_ANALYSIS_MAX_COMMENTS,
    forceReprocess,
  };
}

export function campaignAnalysisEstimateSummary(
  estimate: Record<string, unknown> | undefined,
): CampaignAnalysisEstimateSummary {
  return {
    comments: estimateNumber(
      estimate?.totalCommentsLoaded ?? estimate?.queuedComments,
    ),
    estimatedCostUsd: estimateNumber(estimate?.estimatedCostUsd),
    exceedsLimit: Boolean(estimate?.exceedsLimit),
  };
}

function estimateNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
