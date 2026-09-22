import { NextResponse } from "next/server";
import { forwardGoogleCalendarCallback } from "@/server/google-calendar";

// Compatibilidade com a redirect URI antiga. Novos ambientes devem apontar o
// Google diretamente para o callback público do backend League.
export async function GET(request: Request) {
  return NextResponse.redirect(
    await forwardGoogleCalendarCallback(new URL(request.url)),
  );
}
