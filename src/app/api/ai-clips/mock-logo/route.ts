import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canUseAIClips } from "@/server/league-clips/access";
import { mockAllowed } from "@/server/league-clips/availability";
import { MockClipsError, mockLogoPut } from "@/server/league-clips/mock";
export async function PUT(req: Request) {
  if (
    !mockAllowed(process.env.NODE_ENV, process.env.LEAGUE_CLIPS_MOCK) ||
    process.env.LEAGUE_CLIPS_MOCK !== "1"
  )
    return new NextResponse(null, { status: 404 });
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!canUseAIClips(user)) return new NextResponse(null, { status: 403 });
  const key = new URL(req.url).searchParams.get("key");
  if (!key || !req.body) return new NextResponse(null, { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  const reader = req.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    chunks.push(value);
    if (size > 2 * 1024 * 1024) return new NextResponse(null, { status: 413 });
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    mockLogoPut(key, user.id, bytes, req.headers.get("content-type") ?? "");
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, {
      status: error instanceof MockClipsError ? error.status : 500,
    });
  }
}
