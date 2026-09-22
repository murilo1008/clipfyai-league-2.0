import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { startGoogleCalendarConnection } from "@/server/google-calendar";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const requestUrl = new URL(request.url);
  const campaignId = requestUrl.searchParams.get("campaignId");
  const forceConsent = requestUrl.searchParams.get("force") === "1";
  if (!campaignId)
    return NextResponse.json(
      { error: "campaignId obrigatório" },
      { status: 400 },
    );

  const [user, campaign] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, slug: true },
    }),
  ]);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (!campaign)
    return NextResponse.json(
      { error: "Competição não encontrada" },
      { status: 404 },
    );

  try {
    const { redirectUrl } = await startGoogleCalendarConnection({
      userId,
      campaignId,
      forceConsent,
    });
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Google Calendar OAuth start:", error);
    return NextResponse.redirect(
      new URL(`/competitions/${campaign.slug}?calendar=error`, request.url),
    );
  }
}
