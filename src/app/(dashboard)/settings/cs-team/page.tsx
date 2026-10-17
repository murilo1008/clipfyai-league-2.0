import { redirect } from "next/navigation";

import { getViewer } from "@/server/cs-view/viewer";

import CsTeam from "./cs-team";

export default async function CsTeamPage() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  if (viewer.actor.role !== "ADMIN") {
    redirect("/");
  }

  return <CsTeam />;
}
