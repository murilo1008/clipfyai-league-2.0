import { redirect } from "next/navigation";

import { VideoDownloadsView } from "@/components/video-downloads/video-downloads-view";
import { getViewer } from "@/server/cs-view/viewer";

export default async function ClientDownloadsPage() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  if (viewer.effective.role !== "CLIENT") {
    redirect("/");
  }

  return <VideoDownloadsView mode="client" />;
}
