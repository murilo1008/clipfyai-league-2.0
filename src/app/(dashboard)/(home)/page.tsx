import { redirect } from "next/navigation"

import { getViewer } from "@/server/cs-view/viewer"

import { HomeByRole } from "./home-by-role"
import HomeCs from "./home-cs"

export default async function HomePage() {
  const viewer = await getViewer()

  if (!viewer) {
    redirect("/sign-in")
  }

  // Customer Success sem cliente selecionado: tela de escolha de cliente.
  if (viewer.actor.role === "CUSTOMER_SUCCESS" && !viewer.csView) {
    return <HomeCs stale={viewer.stale} />
  }

  // A partir daqui vale o papel EFETIVO (um CS visualizando um cliente é CLIENT).
  return <HomeByRole role={viewer.effective.role ?? undefined} />
}
