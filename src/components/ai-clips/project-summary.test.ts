import { describe, expect, it } from "vitest";
import {
  optionsSchema,
  statuses,
  type Project,
} from "@/server/league-clips/contracts";
import {
  projectClipsContent,
  readyClipsLabel,
  selectedClipsNotice,
} from "./project-summary";

const project: Pick<Project, "status" | "counts" | "options"> = {
  status: "COMPLETED",
  options: optionsSchema.parse({ clipCount: 10 }),
  counts: { clipsTotal: 6, clipsReady: 6, clipsFailed: 0 },
};

describe("aviso de cortes selecionados", () => {
  it.each(["COMPLETED", "COMPLETED_WITH_ERRORS"] as const)(
    "usa o singular e omite o aviso sem clipes em %s",
    (status) => {
      expect(
        selectedClipsNotice({
          ...project,
          status,
          counts: { clipsTotal: 1, clipsReady: 1, clipsFailed: 0 },
        }),
      ).toBe("Encontramos 1 corte bom de até 10 pedidos.");
      expect(
        selectedClipsNotice({
          ...project,
          status,
          counts: { clipsTotal: 0, clipsReady: 0, clipsFailed: 0 },
        }),
      ).toBeNull();
    },
  );
  it.each(["COMPLETED", "COMPLETED_WITH_ERRORS"] as const)(
    "usa o total selecionado em %s, mesmo quando há falhas de renderização",
    (status) => {
      expect(
        selectedClipsNotice({
          ...project,
          status,
          counts: { clipsTotal: 6, clipsReady: 5, clipsFailed: 1 },
        }),
      ).toBe("Encontramos 6 cortes bons de até 10 pedidos.");
    },
  );
  it.each(
    statuses.filter(
      (status) => status !== "COMPLETED" && status !== "COMPLETED_WITH_ERRORS",
    ),
  )(
    "não mostra o aviso em %s, incluindo total zero durante o processamento",
    (status) => {
      expect(selectedClipsNotice({ ...project, status })).toBeNull();
      expect(
        selectedClipsNotice({
          ...project,
          status,
          counts: { clipsTotal: 0, clipsReady: 0, clipsFailed: 0 },
        }),
      ).toBeNull();
    },
  );
  it.each([10, 11])(
    "não mostra o aviso com %i clipes selecionados",
    (clipsTotal) => {
      expect(
        selectedClipsNotice({
          ...project,
          counts: { clipsTotal, clipsReady: 6, clipsFailed: 4 },
        }),
      ).toBeNull();
    },
  );
});

describe("conteúdo da área de clipes", () => {
  it.each(statuses)("mantém a seção com clipes em %s", (status) => {
    expect(projectClipsContent(status, 1)).toBe("section");
  });
  it.each(statuses)("decide o conteúdo sem clipes em %s", (status) => {
    expect(projectClipsContent(status, 0)).toBe(
      status === "FAILED"
        ? "none"
        : status === "CANCELLED"
          ? "cancelled"
          : "section",
    );
  });
});

describe("resumo de clipes do cartão", () => {
  it.each([
    [5, 6, "5 de 6 clipes prontos"],
    [1, 1, "1 de 1 clipe pronto"],
    [0, 1, "0 de 1 clipe pronto"],
    [1, 6, "1 de 6 clipes prontos"],
    [0, 0, "Nenhum clipe"],
  ])(
    "mostra %i prontos de %i selecionados",
    (clipsReady, clipsTotal, label) => {
      expect(readyClipsLabel({ clipsReady, clipsTotal, clipsFailed: 0 })).toBe(
        label,
      );
    },
  );
});
