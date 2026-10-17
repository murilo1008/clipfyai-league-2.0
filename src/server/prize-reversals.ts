import type { Prisma } from "@prisma/client";

type TransactionReader = Pick<Prisma.TransactionClient, "transaction">;

/**
 * Créditos (entre os informados) anulados por um ADJUSTMENT de estorno que
 * ainda vale. Todo estorno grava `metadata.reversedPrizeCreditId`, seja o
 * "desfazer" do admin (`undo_*`), seja o de uma advertência; a revogação de
 * uma advertência pode devolver o valor com outro ADJUSTMENT que aponta o
 * estorno em `metadata.restoredReversalId`, e aí o crédito volta a valer.
 *
 * Com `actions`, só os estornos com essas `metadata.action` contam.
 */
export async function findReversedPrizeCreditIds(
  db: TransactionReader,
  creditIds: readonly string[],
  options: { actions?: readonly string[] } = {},
): Promise<Set<string>> {
  if (creditIds.length === 0) return new Set<string>();
  const reversals = await db.transaction.findMany({
    where: {
      type: "ADJUSTMENT",
      status: "COMPLETED",
      AND: [
        {
          OR: creditIds.map((creditId) => ({
            metadata: { path: ["reversedPrizeCreditId"], equals: creditId },
          })),
        },
        ...(options.actions
          ? [
              {
                OR: options.actions.map((action) => ({
                  metadata: { path: ["action"], equals: action },
                })),
              },
            ]
          : []),
      ],
    },
    select: { id: true, metadata: true },
  });
  if (reversals.length === 0) return new Set<string>();

  const restorations = await db.transaction.findMany({
    where: {
      type: "ADJUSTMENT",
      status: "COMPLETED",
      OR: reversals.map((reversal) => ({
        metadata: { path: ["restoredReversalId"], equals: reversal.id },
      })),
    },
    select: { metadata: true },
  });
  const restoredReversalIds = new Set(
    restorations
      .map(
        (row) =>
          (row.metadata as { restoredReversalId?: unknown } | null)
            ?.restoredReversalId,
      )
      .filter((id): id is string => typeof id === "string"),
  );

  const ids = new Set(creditIds);
  const reversed = new Set<string>();
  for (const reversal of reversals) {
    if (restoredReversalIds.has(reversal.id)) continue;
    const creditId = (
      reversal.metadata as { reversedPrizeCreditId?: unknown } | null
    )?.reversedPrizeCreditId;
    if (typeof creditId === "string" && ids.has(creditId)) {
      reversed.add(creditId);
    }
  }
  return reversed;
}
