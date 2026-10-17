/**
 * Converte erros do Clerk ao criar/atualizar usuários (clientes, CS…) em TRPCErrors
 * com mensagens em pt-BR. Compartilhado entre os routers que criam contas.
 */
import { TRPCError } from "@trpc/server";

type ClerkErrorDetail = {
  code?: string;
  message?: string;
  longMessage?: string;
};

export function getClerkUserCreationError(error: unknown): TRPCError {
  const clerkError = error as { errors?: ClerkErrorDetail[] };
  const detail = clerkError.errors?.[0];

  if (!detail) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Erro ao comunicar com o sistema de autenticação. Tente novamente.",
    });
  }

  const message =
    `${detail.message ?? ""} ${detail.longMessage ?? ""}`.toLowerCase();

  switch (detail.code) {
    case "form_identifier_exists":
    case "identifier_exists":
      return new TRPCError({
        code: "CONFLICT",
        message: "Já existe uma conta com este email.",
      });
    case "form_password_length_too_short":
      return new TRPCError({
        code: "BAD_REQUEST",
        message: "A senha deve ter pelo menos 8 caracteres.",
      });
    case "form_password_pwned":
      return new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Esta senha aparece em vazamentos conhecidos. Escolha uma senha diferente.",
      });
    case "form_password_not_strong_enough":
    case "form_password_validation_failed":
      return new TRPCError({
        code: "BAD_REQUEST",
        message:
          "A senha não é forte o suficiente. Use maiúsculas, minúsculas, números e símbolos.",
      });
    case "form_param_format_invalid":
      return new TRPCError({
        code: "BAD_REQUEST",
        message: "Email inválido. Verifique o formato informado.",
      });
  }

  if (message.includes("email") && /already|exists|taken|uso/.test(message)) {
    return new TRPCError({
      code: "CONFLICT",
      message: "Já existe uma conta com este email.",
    });
  }

  return new TRPCError({
    code: "BAD_REQUEST",
    message:
      detail.longMessage ||
      detail.message ||
      "Não foi possível validar os dados do cliente.",
  });
}
