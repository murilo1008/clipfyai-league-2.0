import "server-only";

import {
  decryptGoogleCalendarToken,
  googleCalendarEventId,
  refreshGoogleAccessToken,
} from "@/lib/google-calendar-oauth";
import {
  buildGoogleCalendarCampaignEvents,
  type GoogleCalendarEventInput,
} from "@/lib/google-calendar-events";
import { db } from "@/server/db";

function calendarEventUrl(calendarId: string, eventId?: string) {
  const suffix = eventId ? `/${eventId}` : "";
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${suffix}`;
}

async function googleError(response: Response) {
  const body = await response.text().catch(() => "");
  return `Google Calendar HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`;
}

async function upsertEvent(input: {
  accessToken: string;
  calendarId: string;
  campaignId: string;
  event: GoogleCalendarEventInput;
}) {
  const { kind, ...body } = input.event;
  const id = googleCalendarEventId(input.campaignId, kind);
  const headers = {
    Authorization: `Bearer ${input.accessToken}`,
    "Content-Type": "application/json",
  };
  const insert = await fetch(calendarEventUrl(input.calendarId), {
    method: "POST",
    headers,
    body: JSON.stringify({ id, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (insert.ok) return;
  if (insert.status !== 409) throw new Error(await googleError(insert));

  const update = await fetch(calendarEventUrl(input.calendarId, id), {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!update.ok) throw new Error(await googleError(update));
}

async function deleteEvent(input: {
  accessToken: string;
  calendarId: string;
  campaignId: string;
  kind: string;
}) {
  const response = await fetch(
    calendarEventUrl(
      input.calendarId,
      googleCalendarEventId(input.campaignId, input.kind),
    ),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${input.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(await googleError(response));
  }
}

function publicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return (
    process.env.LEAGUE_API_URL?.trim() || "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function syncGoogleCalendarSubscription(subscriptionId: string) {
  const subscription = await db.campaignCalendarSubscription.findUnique({
    where: { id: subscriptionId },
    include: { campaign: true, connection: true },
  });
  if (!subscription?.enabled || subscription.connection.revokedAt) return;

  try {
    const accessToken = await refreshGoogleAccessToken(
      decryptGoogleCalendarToken(subscription.connection.refreshTokenEncrypted),
    );
    const events = buildGoogleCalendarCampaignEvents({
      campaignName: subscription.campaign.name,
      campaignUrl: `${publicAppUrl()}/competitions/${subscription.campaign.slug}`,
      startDate: subscription.campaign.startDate,
      endDate: subscription.campaign.endDate,
      timezone: subscription.campaign.timezone,
    });
    for (const event of events) {
      await upsertEvent({
        accessToken,
        calendarId: subscription.connection.calendarId,
        campaignId: subscription.campaignId,
        event,
      });
    }
    const activeKinds = new Set(events.map(({ kind }) => kind));
    for (const kind of ["ending-7", "ending-3", "ending-1"] as const) {
      if (!activeKinds.has(kind)) {
        await deleteEvent({
          accessToken,
          calendarId: subscription.connection.calendarId,
          campaignId: subscription.campaignId,
          kind,
        });
      }
    }
    const now = new Date();
    await db.$transaction([
      db.campaignCalendarSubscription.update({
        where: { id: subscription.id },
        data: { lastSyncedAt: now, lastError: null },
      }),
      db.googleCalendarConnection.update({
        where: { id: subscription.connectionId },
        data: { lastUsedAt: now, lastError: null },
      }),
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha desconhecida";
    const revoked = /HTTP (400|401|403)/.test(message);
    await db.$transaction([
      db.campaignCalendarSubscription.update({
        where: { id: subscription.id },
        data: { lastError: message },
      }),
      db.googleCalendarConnection.update({
        where: { id: subscription.connectionId },
        data: {
          lastError: message,
          ...(revoked ? { revokedAt: new Date() } : {}),
        },
      }),
    ]);
    throw error;
  }
}

export async function syncGoogleCalendarCampaign(campaignId: string) {
  const subscriptions = await db.campaignCalendarSubscription.findMany({
    where: { campaignId, enabled: true, connection: { revokedAt: null } },
    select: { id: true },
  });
  return Promise.allSettled(
    subscriptions.map(({ id }) => syncGoogleCalendarSubscription(id)),
  );
}

export async function syncAllGoogleCalendarSubscriptions() {
  const subscriptions = await db.campaignCalendarSubscription.findMany({
    where: { enabled: true, connection: { revokedAt: null } },
    select: { id: true },
  });
  const results = await Promise.allSettled(
    subscriptions.map(({ id }) => syncGoogleCalendarSubscription(id)),
  );
  return {
    total: results.length,
    succeeded: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
