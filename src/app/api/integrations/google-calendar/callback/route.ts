import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  encryptGoogleCalendarToken,
  exchangeGoogleCalendarCode,
  fetchGoogleAccountEmail,
  verifyGoogleCalendarState,
} from "@/lib/google-calendar-oauth";
import { db } from "@/server/db";
import { syncGoogleCalendarSubscription } from "@/server/google-calendar-sync";

function destination(request: Request, slug: string, status: string) {
  return new URL(`/competitions/${slug}?calendar=${status}`, request.url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateText = url.searchParams.get("state");
  let campaignSlug: string | null = null;

  try {
    if (!stateText) throw new Error("Estado OAuth ausente");
    const state = verifyGoogleCalendarState(stateText);
    const { userId } = await auth();
    if (!userId || userId !== state.userId)
      throw new Error("Sessão OAuth não corresponde ao usuário");
    const [campaign, user] = await Promise.all([
      db.campaign.findUnique({
        where: { id: state.campaignId },
        select: { id: true, slug: true },
      }),
      db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    if (!campaign) throw new Error("Competição não encontrada");
    campaignSlug = campaign.slug;
    if (user?.role !== "ADMIN") throw new Error("Sem permissão");
    if (!code) {
      throw new Error(
        url.searchParams.get("error_description") || "Autorização cancelada",
      );
    }

    const tokens = await exchangeGoogleCalendarCode(code);
    const existing = await db.googleCalendarConnection.findUnique({
      where: { userId },
      select: { refreshTokenEncrypted: true, googleEmail: true },
    });
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptGoogleCalendarToken(tokens.refresh_token)
      : existing?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted)
      throw new Error("Google não retornou refresh token");
    const googleEmail = await fetchGoogleAccountEmail(tokens.access_token);
    if (
      existing?.googleEmail &&
      (!googleEmail ||
        googleEmail.toLowerCase() !== existing.googleEmail.toLowerCase())
    ) {
      throw new Error(
        `Reconecte usando a conta Google já vinculada (${existing.googleEmail})`,
      );
    }

    const subscriptionId = await db.$transaction(async (tx) => {
      const connection = await tx.googleCalendarConnection.upsert({
        where: { userId },
        create: {
          userId,
          refreshTokenEncrypted,
          googleEmail,
          scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
        },
        update: {
          refreshTokenEncrypted,
          googleEmail,
          scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
          connectedAt: new Date(),
          revokedAt: null,
          lastError: null,
        },
      });
      const subscription = await tx.campaignCalendarSubscription.upsert({
        where: { campaignId_userId: { campaignId: campaign.id, userId } },
        create: {
          campaignId: campaign.id,
          userId,
          connectionId: connection.id,
        },
        update: { connectionId: connection.id, enabled: true, lastError: null },
      });
      return subscription.id;
    });

    await syncGoogleCalendarSubscription(subscriptionId);

    return NextResponse.redirect(
      destination(request, campaign.slug, "connected"),
    );
  } catch (error) {
    console.error("Google Calendar OAuth callback:", error);
    return NextResponse.redirect(
      campaignSlug
        ? destination(request, campaignSlug, "error")
        : new URL("/competitions?calendar=error", request.url),
    );
  }
}
