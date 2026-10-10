import { type Project } from "@/server/league-clips/contracts";
import { projectError } from "@/lib/ai-clips/messages";
import { retryDelay, waitForRetry } from "./upload";

export const uploadCompletionPendingMessage =
  "Seu vídeo foi enviado. Estamos tentando iniciar o processamento; tente de novo em instantes.";

export function recoverableCompleteError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError")
    return false;
  const value = error as {
    status?: number;
    data?: { httpStatus?: number; leagueError?: { status?: number } | null };
  } | null;
  const status =
    value?.data?.leagueError?.status ??
    value?.data?.httpStatus ??
    value?.status;
  return status === undefined || (status >= 500 && status < 600);
}

export function uploadCompletionDecision(status: Project["status"]) {
  if (status === "NEEDS_UPLOAD") return "retry";
  if (status === "FAILED") return "failed";
  return "success";
}

export async function completeUploadedVideo(args: {
  complete: () => Promise<Project>;
  getProject: () => Promise<Project>;
  signal: AbortSignal;
  alreadyCompleted?: boolean;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ kind: "success"; project: Project } | { kind: "pending" }> {
  const inspectProject = async () => {
    let project: Project;
    try {
      project = await args.getProject();
    } catch (error) {
      if (!recoverableCompleteError(error)) throw error;
      return null;
    }
    if (uploadCompletionDecision(project.status) === "failed")
      throw new Error(projectError(project.error));
    return project;
  };
  let inspectBeforeComplete = args.alreadyCompleted ?? false;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (args.signal.aborted)
      throw new DOMException("Upload cancelado", "AbortError");
    let canComplete = true;
    if (inspectBeforeComplete) {
      const project = await inspectProject();
      if (project && uploadCompletionDecision(project.status) === "success")
        return { kind: "success", project };
      canComplete = project !== null;
    }
    if (canComplete) {
      let completedProject: Project | null = null;
      try {
        completedProject = await args.complete();
      } catch (error) {
        if (!recoverableCompleteError(error)) throw error;
        const project = await inspectProject();
        if (project && uploadCompletionDecision(project.status) === "success")
          return { kind: "success", project };
      }
      if (completedProject) {
        const decision = uploadCompletionDecision(completedProject.status);
        if (decision === "failed")
          throw new Error(projectError(completedProject.error));
        if (decision === "success")
          return { kind: "success", project: completedProject };
      }
    }
    inspectBeforeComplete = true;
    if (attempt < 3)
      await (args.sleep ?? ((ms) => waitForRetry(ms, args.signal)))(
        retryDelay(attempt),
      );
  }
  return { kind: "pending" };
}
