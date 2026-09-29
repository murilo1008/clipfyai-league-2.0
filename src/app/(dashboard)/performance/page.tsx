import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { db } from "@/server/db";
import { hasInvestedAmountInEveryCampaign } from "@/server/performance/visibility";

import ClientPerformance from "./performance";

export default async function ClientPerformancePage() {
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== "CLIENT") redirect("/");

  const campaigns = await db.campaign.findMany({
    where: { clientId: userId },
    select: {
      performanceSettings: { select: { investedAmount: true } },
    },
  });
  if (!hasInvestedAmountInEveryCampaign(campaigns)) notFound();

  return <ClientPerformance />;
}
