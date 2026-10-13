import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    campaign: {
      leaveCompetition: {
        useMutation: () => ({ isPending: false, mutate: vi.fn() }),
      },
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { LeaveCompetitionButton } from "./leave-competition-button";

const competition = {
  id: "campaign-1",
  name: "Competição",
  status: "ACTIVE",
  startDate: "2026-10-01T00:00:00Z",
  endDate: "2026-11-01T00:00:00Z",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-09T18:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("restrição de saída após enviar vídeo", () => {
  it("desabilita a saída e explica o bloqueio quando há vídeos enviados", () => {
    const markup = renderToStaticMarkup(
      <LeaveCompetitionButton
        competition={competition}
        applicationStatus="APPROVED"
        postedVideoCount={1}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Saída bloqueada: vídeo enviado");
    expect(markup).toContain(
      'title="Você só pode sair de uma competição se ainda não enviou nenhum vídeo."',
    );
  });

  it("mantém a saída disponível para quem não enviou vídeos", () => {
    const markup = renderToStaticMarkup(
      <LeaveCompetitionButton
        competition={competition}
        applicationStatus="APPROVED"
        postedVideoCount={0}
      />,
    );

    expect(markup).toContain("Sair da competição");
    expect(markup).not.toContain("disabled=");
  });
});
