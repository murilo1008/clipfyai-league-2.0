import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canUseAIClips } from "@/server/league-clips/access";
import { mockAllowed } from "@/server/league-clips/availability";
import { MockClipsError, mockUploadPart } from "@/server/league-clips/mock";

export async function PUT(req: Request) {
  if (
    !mockAllowed(process.env.NODE_ENV, process.env.LEAGUE_CLIPS_MOCK) ||
    process.env.LEAGUE_CLIPS_MOCK !== "1"
  )
    return new NextResponse(null, { status: 404 });
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!canUseAIClips(user)) return new NextResponse(null, { status: 403 });
  const q = new URL(req.url).searchParams;
  const uploadId = q.get("uploadId");
  const partNumber = Number(q.get("partNumber"));
  if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !req.body)
    return new NextResponse(null, { status: 400 });
  try {
    // In dev mode, consume one part as a stream without keeping its bytes.
    let size = 0;
    const reader = req.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024)
        return new NextResponse(null, { status: 413 });
    }
    const etag = mockUploadPart(uploadId, partNumber, user.id, size);
    return new NextResponse(null, { status: 200, headers: { ETag: etag } });
  } catch (error) {
    return new NextResponse(null, {
      status: error instanceof MockClipsError ? error.status : 500,
    });
  }
}
