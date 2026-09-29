import {
  calculatePerformanceSummary,
  getCampaignPerformance,
} from "./get-campaign-performance";

type CampaignPerformance = NonNullable<
  Awaited<ReturnType<typeof getCampaignPerformance>>
>;

export function aggregateCampaignPerformance(
  performances: CampaignPerformance[],
) {
  const investedAmount = performances.reduce(
    (sum, item) => sum + item.summary.investedAmount,
    0,
  );
  const totalViews = performances.reduce(
    (sum, item) => sum + item.summary.totalViews,
    0,
  );
  const equivalentAdsCost = performances.reduce(
    (sum, item) => sum + item.summary.equivalentAdsCost,
    0,
  );
  const referenceCpm =
    totalViews > 0 ? (equivalentAdsCost / totalViews) * 1000 : 0;
  const summary = calculatePerformanceSummary({
    totalViews,
    investedAmount,
    referenceCpm,
  });

  const dates = [
    ...new Set(
      performances.flatMap((item) =>
        item.cpmHistory.map((point) => point.date),
      ),
    ),
  ].sort();
  const positions = performances.map(() => -1);
  const cpmHistory = dates.map((date) => {
    let views = 0;
    let adsCost = 0;
    performances.forEach((item, index) => {
      while (
        positions[index]! + 1 < item.cpmHistory.length &&
        item.cpmHistory[positions[index]! + 1]!.date <= date
      ) {
        positions[index]!++;
      }
      const point = item.cpmHistory[positions[index]!];
      const campaignViews = point?.totalViews ?? 0;
      views += campaignViews;
      adsCost += (campaignViews / 1000) * item.summary.referenceCpm;
    });
    return {
      date,
      totalViews: views,
      investment: investedAmount,
      effectiveCpm: views > 0 ? (investedAmount / views) * 1000 : null,
      referenceCpm: views > 0 ? (adsCost / views) * 1000 : 0,
      estimatedAdsCost: adsCost,
      savings: adsCost - investedAmount,
    };
  });

  return {
    summary,
    cpmHistory,
    profiles: performances.flatMap((item) =>
      item.profiles
        .filter(
          (profile) =>
            profile.lastCollectedAt !== null && profile.history.length > 0,
        )
        .map((profile) => ({
          ...profile,
          campaignName: item.campaign.name,
        })),
    ),
    videos: performances.flatMap((item) =>
      item.videos.map((video) => ({
        ...video,
        campaignName: item.campaign.name,
      })),
    ),
  };
}
