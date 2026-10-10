import { type Project } from "@/server/league-clips/contracts";

export function projectClipsContent(
  status: Project["status"],
  clipsTotal: number,
) {
  if (clipsTotal > 0) return "section";
  if (status === "FAILED") return "none";
  if (status === "CANCELLED") return "cancelled";
  return "section";
}

export function readyClipsLabel(counts: Project["counts"]) {
  if (counts.clipsTotal === 0) return "Nenhum clipe";
  return `${counts.clipsReady} de ${counts.clipsTotal} ${counts.clipsTotal === 1 ? "clipe pronto" : "clipes prontos"}`;
}

export function selectedClipsNotice(
  project: Pick<Project, "status" | "counts" | "options">,
) {
  if (
    (project.status !== "COMPLETED" &&
      project.status !== "COMPLETED_WITH_ERRORS") ||
    project.counts.clipsTotal <= 0 ||
    project.counts.clipsTotal >= project.options.clipCount
  )
    return null;
  return `Encontramos ${project.counts.clipsTotal} ${project.counts.clipsTotal === 1 ? "corte bom" : "cortes bons"} de até ${project.options.clipCount} pedidos.`;
}
