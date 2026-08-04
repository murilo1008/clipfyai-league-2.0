export interface TopClippersPrize {
  position: number;
  prize: number;
}

export function parseTopClippersPrizeTable(value: unknown): TopClippersPrize[] {
  if (!value) return [];

  try {
    const parsed =
      typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    const prizes = new Map<number, number>();

    if (Array.isArray(parsed)) {
      parsed.forEach((item, index) => {
        if (typeof item === "number") {
          if (Number.isFinite(item) && item >= 0) prizes.set(index + 1, item);
          return;
        }

        if (typeof item !== "object" || item === null) return;
        const entry = item as Record<string, unknown>;
        const position = Number(entry.position ?? entry.pos ?? index + 1);
        const prize = Number(entry.prize ?? entry.value ?? entry.amount ?? 0);
        if (
          Number.isInteger(position) &&
          position > 0 &&
          Number.isFinite(prize) &&
          prize >= 0
        ) {
          prizes.set(position, prize);
        }
      });
    } else if (typeof parsed === "object" && parsed !== null) {
      Object.entries(parsed).forEach(([key, rawPrize]) => {
        const prize = Number(rawPrize);
        if (!Number.isFinite(prize) || prize < 0) return;

        const range = /^(\d+)-(\d+)$/.exec(key);
        if (range) {
          const start = Number(range[1]);
          const end = Number(range[2]);
          if (start > 0 && end >= start) {
            for (let position = start; position <= end; position += 1) {
              prizes.set(position, prize);
            }
          }
          return;
        }

        const position = Number(key);
        if (Number.isInteger(position) && position > 0)
          prizes.set(position, prize);
      });
    }

    return Array.from(prizes, ([position, prize]) => ({
      position,
      prize,
    })).sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}

export function getTopClippersPrize(
  prizeTable: TopClippersPrize[],
  position: number,
): number {
  return prizeTable.find((entry) => entry.position === position)?.prize ?? 0;
}
