import { describe, expect, it } from "vitest";

import {
  announcementCategorySchema,
  ANNOUNCEMENT_CATEGORIES,
} from "@/lib/competition-announcements";
import { buildCompetitionAnnouncementEmail } from "./competition-announcement";

const input = {
  campaignName: "Competição",
  campaignSlug: "competicao",
  category: "NOTICE" as const,
  title: "Novos conteúdos",
  content: "Primeira linha\nSegunda linha",
  linkUrl: "https://example.com/video?a=1&b=2",
  appUrl: "https://app.example.com",
};

describe("template do e-mail do mural", () => {
  it("abre o aviso específico mesmo que esteja fora da primeira página do mural", () => {
    const email = buildCompetitionAnnouncementEmail({
      ...input,
      announcementId: "aviso / antigo",
      campaignSlug: "competição teste",
    });
    expect(email.text).toContain(
      "/my-competitions/competi%C3%A7%C3%A3o%20teste?tab=announcements&announcement=aviso+%2F+antigo",
    );
    expect(email.html).toContain("&amp;announcement=aviso+%2F+antigo");
  });
  it("inclui o conteúdo e abre diretamente a aba de avisos", () => {
    const email = buildCompetitionAnnouncementEmail(input);
    expect(email.subject).toContain("Competição: Novos conteúdos");
    expect(email.html).toContain("Primeira linha<br>Segunda linha");
    expect(email.text).toContain(input.content);
    expect(email.html).toContain(
      'href="https://app.example.com/my-competitions/competicao?tab=announcements"',
    );
    expect(email.text).toContain(input.linkUrl);
    expect(email.html).toContain("mso-hide:all;");
  });

  it("escapa conteúdo, título, competição e atributos HTML", () => {
    const email = buildCompetitionAnnouncementEmail({
      ...input,
      campaignName: "Expert & convidados <ao vivo>",
      title: '<img src=x onerror="alert(1)">',
      content: "<script>alert('x')</script>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("Expert &amp; convidados &lt;ao vivo&gt;");
    expect(email.html).toContain("a=1&amp;b=2");
  });

  it.each(announcementCategorySchema.options)(
    "identifica a categoria %s",
    (category) => {
      const email = buildCompetitionAnnouncementEmail({ ...input, category });
      expect(email.subject).toContain(ANNOUNCEMENT_CATEGORIES[category].label);
    },
  );

  it("omite o link opcional e utiliza o domínio padrão", () => {
    const email = buildCompetitionAnnouncementEmail({
      ...input,
      appUrl: undefined,
      linkUrl: null,
    });
    expect(email.html).not.toContain("Acessar conteúdo");
    expect(email.text).toContain(
      "https://league.clipfyai.com/my-competitions/competicao?tab=announcements",
    );
  });
});
