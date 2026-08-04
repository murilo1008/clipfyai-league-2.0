import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

import PostCommentsPanel from "@/app/(dashboard)/posts/[postId]/post-comments-panel";
import { db } from "@/server/db";

interface CompetitionPostCommentsPageProps {
  params: Promise<{ slug: string; postId: string }>;
}

/**
 * Rota ADMIN do post dentro da competição — coleta e análise dos comentários.
 * A rota `/posts/[postId]` é exclusiva do CLIENT (só leitura do resultado);
 * tudo que é operacional (coleta crua, custo em USD, disparo) vive aqui.
 */
export default async function CompetitionPostCommentsPage({
  params,
}: CompetitionPostCommentsPageProps) {
  const { slug, postId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  const post = await db.clipPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      username: true,
      platform: true,
      campaign: { select: { name: true, slug: true } },
    },
  });

  if (!post || post.campaign.slug !== slug) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <div className="flex min-w-0 flex-col gap-2">
        <Link
          href={`/competitions/${slug}`}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs font-semibold transition-colors"
        >
          <CaretLeft className="size-3.5" weight="bold" />
          {post.campaign.name}
        </Link>
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
          Comentários do post
        </h1>
        <p className="text-muted-foreground truncate text-sm">
          {post.username ? `@${post.username.replace(/^@/, "")} · ` : ""}
          {post.platform}
        </p>
      </div>

      <PostCommentsPanel postId={post.id} />
    </div>
  );
}
