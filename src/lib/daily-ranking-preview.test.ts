import { RankingMetricType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getPrizeForPosition,
  nextPrizeTablePosition,
  parsePrizeTable,
} from "./daily-ranking-preview";
import { rankLiveDailyPosts } from "./daily-ranking-shared";

describe("daily ranking prize table", () => {
  it("expande faixas e arredonda para centavos", () => {
    expect(parsePrizeTable({ "1": 100, "2-3": 20.999 })).toEqual([
      { position: 1, prize: 100 },
      { position: 2, prize: 21 },
      { position: 3, prize: 21 },
    ]);
  });

  it("não usa valor implícito para posição ausente", () => {
    expect(getPrizeForPosition(parsePrizeTable({ "1": 100 }), 2)).toBe(0);
  });

  it("recusa tabela vazia em operações que exigem premiação", () => {
    expect(() => parsePrizeTable({})).toThrow("não pode estar vazia");
  });

  it("aceita a mesma posição em duas chaves quando o valor é igual", () => {
    // Tabela real criada pelo antigo "Adicionar Posição" ("5" dentro de "4-15").
    const entries = parsePrizeTable({
      "1": 200,
      "2": 100,
      "3": 60,
      "5": 20,
      "4-15": 20,
    });
    expect(entries).toHaveLength(15);
    expect(getPrizeForPosition(entries, 5)).toBe(20);
    expect(entries.reduce((total, entry) => total + entry.prize, 0)).toBe(600);
  });

  it("recusa a mesma posição com valores diferentes", () => {
    expect(() => parsePrizeTable({ "5": 30, "4-15": 20 })).toThrow(
      "A posição 5 está duplicada",
    );
  });

  it("adiciona posição depois da última coberta, contando faixas", () => {
    expect(nextPrizeTablePosition({ "1": 350, "2": 200, "3": 150, "4-15": 25 })).toBe(16);
    expect(nextPrizeTablePosition({ "1": 10, "2": 5 })).toBe(3);
    expect(nextPrizeTablePosition({})).toBe(1);
  });

  it("exibe ranking sem prêmio quando a competição tem tabela vazia", () => {
    const posts = [{
      postId: "post-1",
      clipperName: "Clipador",
      clipperImageUrl: null,
      username: "clipador",
      platform: "INSTAGRAM",
      thumbnailUrl: "",
      views: 1000,
      likes: 10,
      comments: 2,
      shares: 1,
      saves: 0,
      postedAtIso: "2026-09-29T12:00:00.000Z",
      isCurrentUser: false,
      clanTag: null,
      clanEmoji: null,
      clanEmojiColor: null,
    }];

    for (const dailyPrizeTable of [{}, [], "{}", "[]"]) {
      const ranking = rankLiveDailyPosts({
        posts,
        metricType: RankingMetricType.VIEWS,
        topCount: 15,
        dailyPrizeTable,
      });
      expect(ranking).toHaveLength(1);
      expect(ranking[0]?.prize).toBe(0);
    }
  });

  it("o redutor de advertência reduz o score do post e reordena o ranking ao vivo", () => {
    const base = {
      clipperImageUrl: null,
      username: "",
      platform: "TIKTOK",
      thumbnailUrl: "",
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      postedAtIso: "2026-09-29T12:00:00.000Z",
      isCurrentUser: false,
      clanTag: null,
      clanEmoji: null,
      clanEmojiColor: null,
    };
    const ranking = rankLiveDailyPosts({
      posts: [
        { ...base, postId: "punido", clipperName: "A", views: 1000, scoreMultiplierBps: 8000 },
        { ...base, postId: "normal", clipperName: "B", views: 900 },
      ],
      metricType: RankingMetricType.VIEWS,
      topCount: 15,
      dailyPrizeTable: { "1": 100, "2": 50 },
    });
    expect(ranking.map((row) => [row.postId, row.rankingScore, row.prize])).toEqual([
      ["normal", 900, 100],
      ["punido", 800, 50],
    ]);
    // As views exibidas continuam as reais.
    expect(ranking[1]?.views).toBe(1000);
  });

  it("recusa tabela inválida", () => {
    expect(() => parsePrizeTable({ "1": -1 })).toThrow();
    expect(() => parsePrizeTable("invalid-json")).toThrow();
  });
});
