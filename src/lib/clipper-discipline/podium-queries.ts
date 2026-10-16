import type { PrismaClient } from "@prisma/client";

import { podiumCoversPost } from "@/lib/clipper-discipline/podium";

/**
 * Posts (entre os informados, todos da campanha) de clipadores "inelegíveis
 * ao pódio" no dia em que foram postados, para os caminhos que montam o
 * ranking diário via Prisma (mesmo predicado de podiumIneligibleSql). Nenhuma
 * consulta extra se ninguém tem a sanção.
 */
export async function loadPodiumExcludedPostIds(
  db: Pick<PrismaClient, "clipperSanction" | "clipperApplication">,
  campaignId: string,
  posts: readonly { id: string; applicationId: string; postedAt: Date | null }[],
): Promise<Set<string>> {
  const excluded = new Set<string>();
  const times = posts
    .map((post) => post.postedAt?.getTime())
    .filter((time): time is number => time !== undefined);
  if (times.length === 0) return excluded;
  const sanctions = await db.clipperSanction.findMany({
    where: {
      type: "PODIUM_INELIGIBLE",
      campaignId,
      revokedAt: null,
      startsAt: { lte: new Date(Math.max(...times)) },
      endsAt: { gt: new Date(Math.min(...times)) },
    },
    select: {
      clipperProfileId: true,
      campaignId: true,
      startsAt: true,
      endsAt: true,
      revokedAt: true,
    },
  });
  if (sanctions.length === 0) return excluded;

  const applications = await db.clipperApplication.findMany({
    where: {
      id: { in: [...new Set(posts.map((post) => post.applicationId))] },
      clipperProfileId: {
        in: [...new Set(sanctions.map((sanction) => sanction.clipperProfileId))],
      },
    },
    select: { id: true, clipperProfileId: true },
  });
  const profileByApplication = new Map(
    applications.map((application) => [application.id, application.clipperProfileId]),
  );
  for (const post of posts) {
    const clipperProfileId = profileByApplication.get(post.applicationId);
    if (
      clipperProfileId &&
      podiumCoversPost(sanctions, {
        clipperProfileId,
        campaignId,
        postedAt: post.postedAt,
      })
    ) {
      excluded.add(post.id);
    }
  }
  return excluded;
}

export const PODIUM_LOCK_MESSAGE =
  "O clipador está inelegível ao pódio neste dia por advertência. Desfaça a punição para devolvê-lo ao ranking.";

/**
 * Algum "inelegível ao pódio" ainda valendo cobre o intervalo [from, to) do
 * clipador na competição: as ações do admin que devolvem uma entrada ao
 * ranking do dia param aqui (só a revogação da punição a devolve).
 */
export async function hasActivePodiumSanction(
  db: Pick<PrismaClient, "clipperSanction">,
  input: { clipperProfileId: string; campaignId: string; from: Date; to: Date },
): Promise<boolean> {
  const count = await db.clipperSanction.count({
    where: {
      type: "PODIUM_INELIGIBLE",
      clipperProfileId: input.clipperProfileId,
      campaignId: input.campaignId,
      revokedAt: null,
      startsAt: { lt: input.to },
      endsAt: { gt: input.from },
    },
  });
  return count > 0;
}
