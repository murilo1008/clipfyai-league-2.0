import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  createGoogleCalendarState,
  googleCalendarAuthorizationUrl,
} from "@/lib/google-calendar-oauth";
import { db } from "@/server/db";

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

  const [user, campaign, existingConnection] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, slug: true },
    }),
    db.googleCalendarConnection.findUnique({
      where: { userId },
      select: { id: true, revokedAt: true },
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

  if (existingConnection && !existingConnection.revokedAt && !forceConsent) {
    try {
      await db.campaignCalendarSubscription.upsert({
        where: { campaignId_userId: { campaignId, userId } },
        create: {
          campaignId,
          userId,
          connectionId: existingConnection.id,
        },
        update: {
          connectionId: existingConnection.id,
          enabled: true,
          lastError: null,
        },
      });
      return NextResponse.redirect(
        new URL(
          `/competitions/${campaign.slug}?calendar=connected`,
          request.url,
        ),
      );
    } catch (error) {
      console.error("Google Calendar existing connection:", error);
      return NextResponse.redirect(
        new URL(`/competitions/${campaign.slug}?calendar=error`, request.url),
      );
    }
  }

  try {
    const state = createGoogleCalendarState(userId, campaignId);
    return NextResponse.redirect(googleCalendarAuthorizationUrl(state));
  } catch (error) {
    console.error("Google Calendar OAuth start:", error);
    return NextResponse.redirect(
      new URL(`/competitions/${campaign.slug}?calendar=error`, request.url),
    );
  }
}
