/**
 * Motivos gravados em ClipPost.ineligibilityReason. Os três primeiros são
 * gravados pelo backend league quando ele bloqueia a promoção a ELIGIBLE
 * (league/src/modules/clipper-discipline/discipline.constants.ts) e precisam
 * ficar idênticos aos de lá.
 */
export const DISCIPLINE_OBSERVATION_REASON =
  "Em observação: aguardando aprovação manual";
export const DISCIPLINE_SUSPENSION_REASON =
  "Postado durante suspensão (advertência)";
export const DISCIPLINE_BANNED_REASON = "Conta banida";

/** Prefixo dos motivos gravados pelo próprio frontend ao invalidar vídeos. */
export const DISCIPLINE_INVALIDATION_REASON_PREFIX = "Advertência:";
export const DISCIPLINE_REMOVAL_REASON =
  "Advertência: removido da competição";
export const DISCIPLINE_DAY_RESET_REASON =
  "Advertência: pontos do dia zerados";
/**
 * TopClippersDailyRankingEntry.disqualificationReason do "inelegível ao pódio":
 * marca as entradas que a revogação da sanção devolve ao ranking.
 */
export const DISCIPLINE_PODIUM_REASON = "Advertência: inelegível ao pódio";

/** DailyRankingEntry.dailyPrizeStatus / TopClippersDailyRankingEntry.prizeStatus de um prêmio estornado por advertência. */
export const REVERSED_PRIZE_STATUS = "REVERSED";

/** Prêmio diário resolvido: pago, ou estornado por advertência (não paga de novo). */
export function isSettledDailyPrizeStatus(status: string | null | undefined) {
  return status === "PAID" || status === REVERSED_PRIZE_STATUS;
}

/**
 * A entrada do ranking diário espera PIX? Mesmo critério do league
 * (pix-payout-skip.ts): fora quem não recebe PIX, carteira retida/bloqueada e
 * prêmio estornado por advertência.
 */
export function expectsDailyPix(entry: {
  pixPayoutEligible: boolean;
  walletActive?: boolean | null;
  dailyPrizeStatus?: string | null;
}) {
  return (
    entry.pixPayoutEligible &&
    entry.walletActive !== false &&
    entry.dailyPrizeStatus !== REVERSED_PRIZE_STATUS
  );
}

/** Transaction.metadata.action dos estornos feitos por advertência. */
export const WARNING_PRIZE_REVERSAL_ACTION = "clipper_warning_prize_reversal";
/** Transaction.metadata.action da devolução ao revogar a advertência. */
export const WARNING_PRIZE_RESTORE_ACTION = "clipper_warning_prize_restore";

/** Notification.metadata.kind das notificações de advertência. */
export const CLIPPER_WARNING_NOTIFICATION_KIND = "clipper_warning";

export const MAX_WARNING_LEVEL = 4;

/** Erro de getCompetitionDetails para inscrição removida por advertência (a UI reconhece). */
export const COMPETITION_REMOVED_BY_WARNING_MESSAGE =
  "Você foi removido desta competição por advertência.";
export const COMPETITION_APPLICATION_REVOKED_MESSAGE =
  "Sua inscrição nesta competição foi revogada.";
