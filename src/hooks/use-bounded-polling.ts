import * as React from "react";

/**
 * Polling "enquanto houver algo pendente" com recuo e prazo máximo.
 *
 * Um item travado na fila (ou um endpoint que passou a falhar) não pode
 * manter a tela consultando o servidor para sempre: o intervalo dobra a cada
 * `stepMs` até `maxIntervalMs` e, depois de `maxDurationMs`, o polling para.
 */
export type BoundedPollingOptions = {
  /** Intervalo inicial. */
  initialMs: number;
  /** Teto do intervalo depois do recuo. */
  maxIntervalMs: number;
  /** Tempo após o qual o intervalo dobra. */
  stepMs?: number;
  /** Duração máxima do polling contado a partir do início. */
  maxDurationMs: number;
};

export function boundedPollingInterval(
  elapsedMs: number,
  {
    initialMs,
    maxIntervalMs,
    stepMs = 60_000,
    maxDurationMs,
  }: BoundedPollingOptions,
): number | false {
  if (elapsedMs >= maxDurationMs) return false;
  const steps = Math.max(0, Math.floor(elapsedMs / stepMs));
  return Math.min(maxIntervalMs, initialMs * 2 ** steps);
}

type PollableQuery = { state: { status: string } };

/**
 * Devolve uma função para `refetchInterval` do React Query. O relógio começa
 * na primeira vez em que há algo pendente e recomeça quando `key` muda (ex.:
 * outro job ou nova leva enfileirada). Para de vez quando a consulta falha.
 * `expired` fica `true` quando o prazo acabou com algo ainda pendente — a tela
 * pode oferecer um "atualizar" manual.
 */
export function useBoundedPolling(
  key: string | null,
  options: BoundedPollingOptions,
) {
  const { initialMs, maxIntervalMs, stepMs, maxDurationMs } = options;
  const startRef = React.useRef<{ key: string | null; at: number } | null>(
    null,
  );
  const [expiredKey, setExpiredKey] = React.useState<string | null>(null);
  const [expiredOnce, setExpiredOnce] = React.useState(false);

  const interval = React.useCallback(
    (query: PollableQuery, isPending: boolean): number | false => {
      if (!isPending || query.state.status === "error") return false;
      const now = Date.now();
      // Nova chave (ou primeira pendência): recomeça a contagem.
      if (!startRef.current || startRef.current.key !== key) {
        startRef.current = { key, at: now };
      }
      const next = boundedPollingInterval(now - startRef.current.at, {
        initialMs,
        maxIntervalMs,
        stepMs,
        maxDurationMs,
      });
      if (next === false) {
        // Chamado fora do render pelo React Query: só sinaliza para a tela.
        setExpiredKey(key);
        setExpiredOnce(true);
      }
      return next;
    },
    [key, initialMs, maxIntervalMs, stepMs, maxDurationMs],
  );

  /** Recomeça a contagem (ex.: depois de um "atualizar" manual). */
  const restart = React.useCallback(() => {
    startRef.current = null;
    setExpiredOnce(false);
  }, []);

  const expired = expiredOnce && expiredKey === key;

  return { interval, expired, restart };
}
