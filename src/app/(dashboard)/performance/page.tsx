import { notFound, redirect } from "next/navigation";

import { getViewer } from "@/server/cs-view/viewer";
import { db } from "@/server/db";
import { hasInvestedAmountInEveryCampaign } from "@/server/performance/visibility";

import ClientPerformance from "./performance";

export default async function ClientPerformancePage() {
  const viewer = await getViewer();

  if (!viewer) redirect("/sign-in");

  if (viewer.effective.role !== "CLIENT") redirect("/");

  // Em modo Customer Success, `effective.id` é o cliente visualizado.
  const campaigns = await db.campaign.findMany({
    where: { clientId: viewer.effective.id },
    select: {
      performanceSettings: { select: { investedAmount: true } },
    },
  });
  if (!hasInvestedAmountInEveryCampaign(campaigns)) notFound();

  return <ClientPerformance />;
}
