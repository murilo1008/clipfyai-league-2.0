import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { db } from "@/server/db";

import PostDetail from "./post-detail";

interface PostPageProps {
  params: Promise<{ postId: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { postId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role !== "CLIENT") {
    redirect("/");
  }

  return <PostDetail postId={postId} />;
}
