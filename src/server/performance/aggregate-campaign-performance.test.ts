import { describe, expect, it } from "vitest";
import { aggregateCampaignPerformance } from "./aggregate-campaign-performance";

type Performance = Parameters<typeof aggregateCampaignPerformance>[0][number];

function campaign(
  name: string,
  investedAmount: number,
  referenceCpm: number,
  history: Array<[string, number]>,
): Performance {
  const totalViews = history.at(-1)?.[1] ?? 0;
  return {
    campaign: { name },
    summary: {
      investedAmount,
      totalViews,
      referenceCpm,
      equivalentAdsCost: (totalViews / 1000) * referenceCpm,
    },
    cpmHistory: history.map(([date, views]) => ({ date, totalViews: views })),
    profiles: [],
    videos: [],
  } as unknown as Performance;
}

describe("aggregateCampaignPerformance", () => {
  it("soma os investimentos e mantém a última coleta de cada competição em datas diferentes", () => {
    const result = aggregateCampaignPerformance([
      campaign("A", 100, 10, [
        ["2026-09-01T12:00:00.000Z", 1000],
        ["2026-09-03T12:00:00.000Z", 2000],
      ]),
      campaign("B", 200, 20, [["2026-09-02T12:00:00.000Z", 3000]]),
    ]);

    expect(result.summary.investedAmount).toBe(300);
    expect(result.summary.totalViews).toBe(5000);
    expect(result.summary.referenceCpm).toBe(16);
    expect(result.cpmHistory.map((point) => point.totalViews)).toEqual([
      1000, 4000, 5000,
    ]);
    expect(result.cpmHistory.at(-1)?.effectiveCpm).toBe(60);
    expect(result.cpmHistory.at(-1)?.estimatedAdsCost).toBe(80);
  });
});
