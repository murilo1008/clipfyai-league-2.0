import { type ErrorCode, type Project } from "@/server/league-clips/contracts";
export const messages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Confira os dados informados.",
  NOT_FOUND: "Item não encontrado.",
  FORBIDDEN: "Você não tem acesso a este item.",
  UNAUTHORIZED: "Entre na sua conta para continuar.",
  RATE_LIMITED: "Muitas solicitações agora. Tente novamente em instantes.",
  VERSION_CONFLICT:
    "O clipe foi alterado em outra sessão. Recarregue para continuar.",
  IDEMPOTENCY_CONFLICT: "Este envio já foi usado com outros dados.",
  PROJECT_NOT_READY: "Aguarde o projeto terminar antes de editar.",
  TOO_MANY_ACTIVE_PROJECTS: "Você já tem dois projetos em andamento.",
  INSUFFICIENT_CREDITS: "Créditos insuficientes para este vídeo.",
  INVALID_URL: "Informe um link válido.",
  UNSUPPORTED_PLATFORM: "Essa plataforma ainda não é aceita.",
  SSRF_BLOCKED: "Esse endereço não é permitido.",
  UPLOAD_EXPIRED: "O envio expirou. Inicie um novo upload.",
  UPLOAD_INCOMPLETE: "Ainda há partes do arquivo pendentes.",
  SOURCE_TOO_LONG: "O vídeo ultrapassa o limite de 2 horas.",
  SOURCE_TOO_SHORT: "O vídeo deve ter pelo menos 5 segundos.",
  SOURCE_TOO_LARGE: "O arquivo ultrapassa o limite de 4 GB.",
  DOWNLOAD_BLOCKED:
    "A plataforma bloqueou o download. Envie o arquivo para continuar.",
  DOWNLOAD_FAILED: "Não foi possível baixar o vídeo.",
  PROBE_FAILED: "Não foi possível analisar o arquivo de vídeo.",
  NO_AUDIO: "O vídeo não contém áudio.",
  TRANSCRIPTION_FAILED: "Não foi possível transcrever o áudio.",
  TRANSCRIPTION_EMPTY: "Nenhuma fala foi detectada.",
  LANGUAGE_MISMATCH: "O idioma do vídeo não corresponde ao selecionado.",
  ANALYSIS_FAILED: "Não foi possível analisar os momentos do vídeo.",
  NO_MOMENTS_FOUND:
    "Não encontramos momentos com potencial de corte neste vídeo. Seus créditos foram devolvidos.",
  LLM_COST_LIMIT: "O limite de análise foi atingido.",
  VISION_FAILED: "Não foi possível enquadrar o vídeo.",
  RENDER_FAILED: "Não foi possível gerar um clipe.",
  QA_FAILED: "O clipe gerado não passou na verificação.",
  STORAGE_ERROR: "Falha ao acessar o armazenamento.",
  CANCELLED: "Operação cancelada.",
  TIMEOUT: "A operação demorou mais do que o esperado.",
  INTERNAL: "Ocorreu um erro inesperado.",
};
export function messageForCode(code: ErrorCode) {
  return messages[code];
}
export function projectError(error: Project["error"]) {
  if (!error) return "Não foi possível processar o vídeo.";
  const message = messageForCode(error.code);
  return error.code === "NO_MOMENTS_FOUND" ||
    !error.message ||
    error.message === message
    ? message
    : message + " " + error.message;
}
