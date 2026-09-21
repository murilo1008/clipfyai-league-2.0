import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { syncAllGoogleCalendarSubscriptions } from "@/server/google-calendar-sync";

function authorized(request: Request) {
  const expected = process.env.LEAGUE_INTERNAL_API_KEY?.trim();
  const received = request.headers.get("x-internal-api-key")?.trim();
  if (!expected || !received || expected.length !== received.length)
    return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return NextResponse.json(await syncAllGoogleCalendarSubscriptions());
}
