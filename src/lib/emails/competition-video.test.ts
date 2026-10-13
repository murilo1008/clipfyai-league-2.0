import { describe, expect, it } from "vitest";

import { buildCompetitionVideoEmail } from "./competition-video";

const input = {
  recipientName: "Ana Silva",
  campaignName: "Competição de Outubro",
  campaignSlug: "competicao-de-outubro",
  videoTitle: "Episódio 01 — Bastidores",
  videoUrl: "https://www.youtube.com/watch?v=official-video",
};

describe("e-mail de vídeo obrigatório", () => {
  it("identifica o conteúdo obrigatório e inclui os links no HTML e no texto", () => {
    const email = buildCompetitionVideoEmail(input);
    const competitionUrl =
      "https://league.clipfyai.com/my-competitions/competicao-de-outubro";

    expect(email.subject).toBe(
      "Vídeo obrigatório disponível — Competição de Outubro",
    );
    expect(email.html).toContain("NOVO VÍDEO OBRIGATÓRIO PARA CORTE");
    expect(email.html).toContain("mso-hide:all;");
    expect(email.html).toContain(`href="${input.videoUrl}"`);
    expect(email.html).toContain(`href="${competitionUrl}"`);
    expect(email.html).toContain(input.videoTitle);
    expect(email.text).toContain("Olá, Ana!");
    expect(email.text).toContain(input.videoUrl);
    expect(email.text).toContain(competitionUrl);
    expect(email.text).toContain("regras, hashtags e menções");
  });

  it("escapa conteúdo dinâmico e parâmetros de URL no HTML", () => {
    const email = buildCompetitionVideoEmail({
      ...input,
      recipientName: '<script>alert("name")</script>',
      campaignName: "Expert & convidados <ao vivo>",
      videoTitle: '<img src=x onerror="alert(1)">',
      videoUrl: "https://www.youtube.com/watch?v=official&list=campaign",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("Expert &amp; convidados &lt;ao vivo&gt;");
    expect(email.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(email.html).toContain("v=official&amp;list=campaign");
    expect(email.text).toContain("v=official&list=campaign");
  });

  it("oferece textos alternativos quando nome e título estão vazios", () => {
    const email = buildCompetitionVideoEmail({
      ...input,
      recipientName: " ",
      videoTitle: " ",
    });

    expect(email.text).toContain("Olá, Clipador!");
    expect(email.html).toContain("Novo conteúdo oficial");
  });

  it("usa o endereço configurado e codifica o slug no link da competição", () => {
    const email = buildCompetitionVideoEmail({
      ...input,
      campaignSlug: "competição especial",
      appUrl: "https://app.example.com/",
    });

    expect(email.text).toContain(
      "https://app.example.com/my-competitions/competi%C3%A7%C3%A3o%20especial",
    );
  });
});
