import { redirect } from "next/navigation";

import { getViewer } from "@/server/cs-view/viewer";

import Posts from "./posts";

export default async function PostsPage() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  if (viewer.effective.role !== "CLIENT") {
    redirect("/");
  }

  return <Posts />;
}
