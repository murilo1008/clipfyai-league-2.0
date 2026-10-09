import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendBatch = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    batch = { send: sendBatch };
  },
}));

import { sendCompetitionAnnouncementEmails } from "./competition-announcement-emails";
import {
  buildCompetitionAnnouncementEmail,
  COMPETITION_ANNOUNCEMENT_EMAIL_FROM,
} from "@/lib/emails/competition-announcement";

const input = {
  announcementId: "post-1",
  campaignName: "Competição",
  campaignSlug: "competicao",
  category: "NOTICE" as const,
  title: "Novo aviso",
  content: "Confira o mural.",
  linkUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  sendBatch.mockImplementation(async (emails: unknown[]) => ({
    data: { data: emails.map((_, index) => ({ id: `email-${index}` })) },
    error: null,
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("e-mails do mural", () => {
  it("envia o template institucional com link direto ao aviso", async () => {
    await sendCompetitionAnnouncementEmails({
      ...input,
      recipients: ["clipper@example.com"],
    });
    const email = buildCompetitionAnnouncementEmail(input);
    expect(sendBatch).toHaveBeenCalledWith(
      [
        {
          from: COMPETITION_ANNOUNCEMENT_EMAIL_FROM,
          to: "clipper@example.com",
          ...email,
        },
      ],
      { idempotencyKey: "competition-announcement/post-1/0" },
    );
  });
  it("normaliza e deduplica destinatários sem expor a lista aos clipadores", async () => {
    const result = await sendCompetitionAnnouncementEmails({
      ...input,
      recipients: [
        " Ana@Example.com ",
        "ana@example.com",
        "bia@example.com",
        " ",
      ],
    });
    expect(result).toEqual({ sent: 2, error: null });
    const emails = sendBatch.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    expect(emails.map((email) => email.to)).toEqual([
      "ana@example.com",
      "bia@example.com",
    ]);
    expect(emails.every((email) => !email.cc && !email.bcc)).toBe(true);
    expect(emails[0]?.html).not.toContain("bia@example.com");
  });

  it("divide grandes listas em lotes de 100 e usa chaves por postagem e lote", async () => {
    vi.useFakeTimers();
    const sending = sendCompetitionAnnouncementEmails({
      ...input,
      recipients: Array.from(
        { length: 205 },
        (_, index) => `clipper-${index}@example.com`,
      ),
    });
    await vi.runAllTimersAsync();
    expect(await sending).toEqual({ sent: 205, error: null });
    expect(
      sendBatch.mock.calls.map(([emails]) => (emails as unknown[]).length),
    ).toEqual([100, 100, 5]);
    expect(sendBatch.mock.calls.map(([, options]) => options)).toEqual([
      { idempotencyKey: "competition-announcement/post-1/0" },
      { idempotencyKey: "competition-announcement/post-1/1" },
      { idempotencyKey: "competition-announcement/post-1/2" },
    ]);
  });

  it("contabiliza apenas os lotes confirmados quando há falha parcial", async () => {
    vi.useFakeTimers();
    sendBatch.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limit" },
    });
    const sending = sendCompetitionAnnouncementEmails({
      ...input,
      recipients: Array.from(
        { length: 101 },
        (_, index) => `clipper-${index}@example.com`,
      ),
    });
    await vi.runAllTimersAsync();
    expect(await sending).toEqual({ sent: 1, error: "Rate limit" });
  });

  it("retorna falha sem expor detalhes internos em exceções de rede", async () => {
    sendBatch.mockRejectedValue(new Error("Sensitive network information"));
    const result = await sendCompetitionAnnouncementEmails({
      ...input,
      recipients: ["ana@example.com"],
    });
    expect(result.sent).toBe(0);
    expect(result.error).toContain("lote de e-mails");
    expect(result.error).not.toContain("Sensitive");
  });

  it("não afirma que enviou quando o serviço não confirma", async () => {
    sendBatch.mockResolvedValue({ data: null, error: null });
    const result = await sendCompetitionAnnouncementEmails({
      ...input,
      recipients: ["ana@example.com"],
    });
    expect(result.sent).toBe(0);
    expect(result.error).toContain("não confirmou");
  });

  it("registra erro quando o serviço confirma apenas parte de um lote", async () => {
    sendBatch.mockResolvedValue({
      data: { data: [{ id: "accepted-email" }] },
      error: null,
    });
    const result = await sendCompetitionAnnouncementEmails({
      ...input,
      recipients: ["ana@example.com", "bia@example.com"],
    });
    expect(result.sent).toBe(1);
    expect(result.error).toContain("Nem todos os e-mails");
  });

  it("informa quando o envio não está configurado", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendCompetitionAnnouncementEmails({
      ...input,
      recipients: ["ana@example.com"],
    });
    expect(result.sent).toBe(0);
    expect(result.error).toContain("não está configurado");
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("conclui sem envio quando não há destinatários", async () => {
    expect(
      await sendCompetitionAnnouncementEmails({ ...input, recipients: [] }),
    ).toEqual({ sent: 0, error: null });
    expect(sendBatch).not.toHaveBeenCalled();
  });
});
