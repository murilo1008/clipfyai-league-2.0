export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export const PIX_KEY_TYPE_OPTIONS: Array<{ value: PixKeyType; label: string }> =
  [
    { value: "CPF", label: "CPF" },
    { value: "CNPJ", label: "CNPJ" },
    { value: "EMAIL", label: "E-mail" },
    { value: "PHONE", label: "Telefone" },
    { value: "EVP", label: "Chave aleatoria" },
  ];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce(
      (acc, weight, index) => acc + Number(base[index]) * weight,
      0,
    );
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}

function looksLikeEmail(value: string): boolean {
  const at = value.indexOf("@");
  return at > 0 && at < value.length - 1 && value.includes(".", at);
}

export function normalizePixKeyForType(
  value: string,
  type: PixKeyType,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Informe a chave PIX." };
  }

  if (type === "EMAIL") {
    if (!looksLikeEmail(trimmed))
      return { ok: false, error: "Informe um e-mail valido para a chave PIX." };
    return { ok: true, value: trimmed.toLowerCase() };
  }

  if (type === "EVP") {
    if (!UUID_REGEX.test(trimmed))
      return { ok: false, error: "Informe uma chave aleatoria PIX valida." };
    return { ok: true, value: trimmed.toLowerCase() };
  }

  const digits = onlyDigits(trimmed);

  if (type === "CPF") {
    if (!isValidCpf(digits))
      return { ok: false, error: "Informe um CPF valido para a chave PIX." };
    return { ok: true, value: digits };
  }

  if (type === "CNPJ") {
    if (!isValidCnpj(digits))
      return { ok: false, error: "Informe um CNPJ valido para a chave PIX." };
    return { ok: true, value: digits };
  }

  if (digits.startsWith("55") && digits.length === 13) {
    return { ok: true, value: `+${digits}` };
  }

  if (digits.length === 11) {
    return { ok: true, value: `+55${digits}` };
  }

  return {
    ok: false,
    error: "Informe um telefone brasileiro com DDD para a chave PIX.",
  };
}

export function inferPixKeyType(value: string | null | undefined): PixKeyType {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "CPF";
  if (trimmed.includes("@")) return "EMAIL";
  if (UUID_REGEX.test(trimmed)) return "EVP";

  const digits = onlyDigits(trimmed);
  if (digits.length === 14) return "CNPJ";
  if (digits.startsWith("55") && digits.length === 13) return "PHONE";
  if (digits.length === 11 && !isValidCpf(digits)) return "PHONE";
  return "CPF";
}

export function pixKeyPlaceholder(type: PixKeyType): string {
  switch (type) {
    case "CPF":
      return "000.000.000-00";
    case "CNPJ":
      return "00.000.000/0000-00";
    case "EMAIL":
      return "email@dominio.com";
    case "PHONE":
      return "(11) 99999-9999";
    case "EVP":
      return "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
  }
}
