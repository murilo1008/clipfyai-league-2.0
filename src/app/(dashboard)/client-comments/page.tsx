import { redirect } from "next/navigation";

import { getViewer } from "@/server/cs-view/viewer";

import ClientComments from "./client-comments";

export default async function ClientCommentsPage() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  if (viewer.effective.role !== "CLIENT") {
    redirect("/");
  }

  return <ClientComments />;
}
