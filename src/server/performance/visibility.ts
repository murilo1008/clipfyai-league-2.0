type InvestmentSettings = {
  investedAmount: unknown;
} | null;

export function hasInvestedAmountInEveryCampaign(
  campaigns: Array<{ performanceSettings: InvestmentSettings }>,
): boolean {
  return (
    campaigns.length > 0 &&
    campaigns.every(
      (campaign) => Number(campaign.performanceSettings?.investedAmount) > 0,
    )
  );
}
