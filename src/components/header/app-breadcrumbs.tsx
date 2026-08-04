"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { House } from "@phosphor-icons/react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/trpc/react"

/**
 * Labels PT-BR por segmento de rota.
 * Mantido em sincronia com os títulos da sidebar (src/config/navigation.ts):
 * o rótulo do breadcrumb deve ser o mesmo que o usuário clicou no menu.
 */
const SEGMENT_LABELS: Record<string, string> = {
  /* ── Núcleo do dashboard ─────────────────────────────────────────────── */
  home: "Início",
  dashboard: "Dashboard",
  admin: "Administração",
  settings: "Configurações",
  profile: "Perfil",
  overview: "Visão Geral",

  /* ── Competições ─────────────────────────────────────────────────────── */
  campaigns: "Campanhas",
  competitions: "Competições",
  "my-competitions": "Minhas Competições",
  schedule: "Cronograma",
  history: "Histórico",
  reports: "Relatórios",
  leaderboard: "Ranking",
  ranking: "Ranking",
  submissions: "Envios",
  "data-metrics": "Dados & Métricas",
  library: "Biblioteca",
  "spotify-metrics": "Músicas Spotify",
  "video-downloads": "Downloads",

  /* ── Pessoas e organizações ──────────────────────────────────────────── */
  organizations: "Organizações",
  clippers: "Clipadores",
  users: "Usuários",
  members: "Membros",
  clients: "Clientes",
  leads: "Leads",
  clans: "Clãs",
  acquisition: "Captação",
  aquisition: "Captação",
  affiliates: "Afiliados",

  /* ── Financeiro ──────────────────────────────────────────────────────── */
  financial: "Financeiro",
  wallet: "Carteira",
  withdrawals: "Saques",
  transactions: "Transações",
  sales: "Vendas",

  /* ── Análise e auditoria ─────────────────────────────────────────────── */
  analytics: "Análises",
  fraud: "Antifraude",
  audit: "Auditoria",

  /* ── Contas sociais ──────────────────────────────────────────────────── */
  "manage-accounts": "Gerenciar Contas",
  "social-accounts": "Contas Sociais",
  accounts: "Contas",

  /* ── Academia e aulas ────────────────────────────────────────────────── */
  academy: "Academia",
  classes: "Academia Clipadora",
  modules: "Módulos",
  lessons: "Aulas",
  module: "Módulo",
  manual: "Manual do Clipador",

  /* ── Conteúdo ────────────────────────────────────────────────────────── */
  posts: "Posts",
  blog: "Blog",
  "blog-admin": "Blog",
  categories: "Categorias",
  comments: "Comentários",

  /* ── Área do cliente ─────────────────────────────────────────────────── */
  "client-comments": "Comentários",
  "client-downloads": "Downloads",

  /* ── Outros ──────────────────────────────────────────────────────────── */
  "interest-list": "Lista de Interesse",
  "clipfy-ai": "Clipfy AI",

  /*
   * Rotas públicas (fora do grupo (dashboard), onde o breadcrumb não é
   * renderizado hoje) — mapeadas por segurança, para o dia em que forem
   * reaproveitadas dentro do app.
   */
  "sign-in": "Entrar",
  "sign-up": "Criar conta",
  "forgot-password": "Recuperar senha",
  onboarding: "Cadastro",
  approve: "Aprovação",
  banned: "Conta suspensa",
  "thank-you": "Obrigado",
  upsell: "Oferta",
  pro: "Clipfy PRO",
  ultra: "Clipfy Ultra",
  "landing-page": "Página Inicial",
  rules: "Regras",
  "privacy-policy": "Política de Privacidade",
  "terms-of-use": "Termos de Uso",
  "academia-clipadora": "Academia Clipadora",
  "manual-do-clipador": "Manual do Clipador",
}

/**
 * Identificadores (cuid, cuid2 ou uuid) que nunca devem virar texto —
 * "cmnunyzlw0009id04vleej0rs" não é um nome de página.
 */
const ID_PATTERN =
  /^(c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,})$/i

/** Rótulo de um segmento de ID conforme o recurso pai na URL. */
const ID_LABELS: Record<string, string> = {
  posts: "Detalhes do post",
  organizations: "Detalhes da organização",
  clippers: "Detalhes do clipador",
  competitions: "Detalhes da competição",
  lessons: "Detalhes da aula",
  modules: "Detalhes do módulo",
}

/** Conectores que ficam em minúscula ao formatar um slug legível. */
const LOWERCASE_WORDS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "sem",
])

/** Slug → título legível: "tarcisio-de-freitas" → "Tarcisio de Freitas". */
function humanizeSlug(segment: string): string {
  return decodeURIComponent(segment)
    .split("-")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}

function labelFor(segment: string, parent?: string): string {
  const mapped = SEGMENT_LABELS[segment]
  if (mapped) return mapped
  // IDs opacos viram o nome do recurso, nunca o identificador cru
  if (ID_PATTERN.test(segment)) {
    return (parent && ID_LABELS[parent]) ?? "Detalhes"
  }
  return humanizeSlug(segment)
}

/** Sub-rotas estáticas de /clans que NÃO são tag de clã. */
const CLAN_STATIC_CHILDREN = new Set(["reports"])

export function AppBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  // /clans/[tag] — resolver o nome real do clã (query admin-only)
  const clanTag =
    segments[0] === "clans" &&
    segments[1] &&
    !CLAN_STATIC_CHILDREN.has(segments[1])
      ? decodeURIComponent(segments[1])
      : undefined

  const { data: user } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: !!clanTag,
  })
  const { data: clan, isLoading: isLoadingClan } = api.clan.getByTag.useQuery(
    { tag: clanTag ?? "" },
    { enabled: !!clanTag && user?.role === "ADMIN" },
  )

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {segments.length === 0 ? (
            <BreadcrumbPage className="flex items-center gap-1.5">
              <House className="size-3.5" weight="duotone" />
              Início
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/" className="flex items-center gap-1.5">
                <House className="size-3.5" weight="duotone" />
                Início
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`
          const isLast = index === segments.length - 1

          // Nome real do clã em /clans/[tag] (skeleton enquanto carrega)
          let label: React.ReactNode = labelFor(segment, segments[index - 1])
          if (clanTag && index === 1) {
            if (isLoadingClan && user?.role === "ADMIN") {
              label = <Skeleton className="h-4 w-28" />
            } else if (clan?.name) {
              label = clan.name
            }
          }

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
