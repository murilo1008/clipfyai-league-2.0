import { redirect } from "next/navigation";

import { getViewer } from "@/server/cs-view/viewer";

import PostDetail from "./post-detail";

interface PostPageProps {
  params: Promise<{ postId: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { postId } = await params;
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  if (viewer.effective.role !== "CLIENT") {
    redirect("/");
  }

  return <PostDetail postId={postId} />;
}
