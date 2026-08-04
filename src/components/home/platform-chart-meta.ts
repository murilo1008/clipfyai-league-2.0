import { platformConfig, type PlatformKey } from "@/lib/platform-config"

/** Ordem fixa do stack — nunca ciclada (paleta validada por adjacência). */
export const PLATFORM_ORDER = [
  "FACEBOOK",
  "INSTAGRAM",
  "KWAI",
  "TIKTOK",
  "YOUTUBE",
] as const

/** Cor por plataforma via CSS var — muda junto com o tema. */
export const PLATFORM_CHART_COLORS: Record<string, string> = {
  FACEBOOK: "var(--chart-facebook)",
  INSTAGRAM: "var(--chart-instagram)",
  KWAI: "var(--chart-kwai)",
  TIKTOK: "var(--chart-tiktok)",
  YOUTUBE: "var(--chart-youtube)",
}

export function platformMeta(platform: string) {
  const config = platformConfig[platform as PlatformKey]
  return {
    label: config?.label ?? platform,
    Icon: config?.icon,
    color: PLATFORM_CHART_COLORS[platform] ?? "var(--chart-tiktok)",
  }
}

export const formatChartDate = (iso: string) => {
  const [year, month, day] = iso.split("-")
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ]
  return `${day}/${months[Number(month) - 1]}`
}
