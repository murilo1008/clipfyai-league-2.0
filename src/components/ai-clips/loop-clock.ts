"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Relógio em laço das prévias animadas (requestAnimationFrame a ~30 quadros/s). Parado, mantém o instante; `seek`
 * leva a um instante e continua dali. Com a aba em segundo plano o navegador suspende o rAF sozinho.
 */
export function useLoopClock({
  periodMs,
  playing,
  fps = 30,
}: {
  periodMs: number;
  playing: boolean;
  fps?: number;
}) {
  const [timeMs, setTimeMs] = useState(0);
  const timeRef = useRef(0);
  const [anchor, setAnchor] = useState(0);
  useEffect(() => {
    if (!playing || !(periodMs > 0)) return;
    let frame = 0,
      last = -Infinity;
    const start = performance.now() - timeRef.current;
    const tick = (now: number) => {
      if (now - last >= 1000 / fps - 1) {
        last = now;
        const next = (now - start) % periodMs;
        timeRef.current = next;
        setTimeMs(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, periodMs, fps, anchor]);
  const seek = useCallback((next: number) => {
    timeRef.current = next;
    setTimeMs(next);
    setAnchor((value) => value + 1);
  }, []);
  return { timeMs: periodMs > 0 ? timeMs % periodMs : 0, seek };
}
