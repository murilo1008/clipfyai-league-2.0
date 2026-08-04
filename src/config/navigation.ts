import type { Icon } from "@phosphor-icons/react";
import {
  ChatCircleText,
  DiscordLogo,
  DownloadSimple,
  FilmSlate,
  GearSix,
  GraduationCap,
  Handshake,
  House,
  Newspaper,
  Shield,
  Trophy,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";

export type NavSubItem = {
  title: string;
  url: string;
};

export type NavItem = {
  title: string;
  url: string;
  icon: Icon;
  items: NavSubItem[];
  defaultOpen?: boolean;
  /** Link externo (abre em nova aba) — ex.: Discord */
  external?: boolean;
  /** Tinta fixa do ícone (ex.: blurple do Discord) */
  iconClass?: string;
};

const HOME_ITEM: NavItem = {
  title: "Home",
  url: "/",
  icon: House,
  items: [],
};

/**
 * Menus da sidebar por role — mesmas rotas e labels da Clipfy League.
 */
const MENU_BY_ROLE: Record<string, NavItem[]> = {
  ADMIN: [
    HOME_ITEM,
    {
      title: "Competições",
      url: "/competitions",
      icon: Trophy,
      defaultOpen: true,
      items: [
        { title: "Todas", url: "/competitions" },
        { title: "Dados & Métricas", url: "/competitions/data-metrics" },
        { title: "Relatórios", url: "/competitions/reports" },
        { title: "Biblioteca", url: "/competitions/library" },
        { title: "Financeiro", url: "/competitions/financial" },
        { title: "Músicas Spotify", url: "/competitions/spotify-metrics" },
        { title: "Downloads", url: "/competitions/video-downloads" },
      ],
    },
    {
      title: "Clipadores",
      url: "/clippers",
      icon: FilmSlate,
      items: [
        { title: "Gerenciar", url: "/clippers" },
        { title: "Visão Geral", url: "/clippers/overview" },
        { title: "Captação", url: "/clippers/acquisition" },
        { title: "Contas", url: "/clippers/accounts" },
        { title: "Ranking", url: "/clippers/ranking" },
        { title: "Afiliados", url: "/clippers/affiliates" },
      ],
    },
    {
      title: "Clãs",
      url: "/clans",
      icon: Shield,
      items: [
        { title: "Gerenciar", url: "/clans" },
        { title: "Relatórios", url: "/clans/reports" },
      ],
    },
    {
      title: "Academia Clipadora",
      url: "/academy",
      icon: GraduationCap,
      items: [
        { title: "Visão Geral", url: "/academy" },
        { title: "Métricas & Engajamento", url: "/academy/reports" },
        { title: "Módulos", url: "/academy/modules" },
        { title: "Aulas", url: "/academy/lessons" },
      ],
    },
    {
      title: "Blog",
      url: "/blog-admin",
      icon: Newspaper,
      items: [
        { title: "Posts", url: "/blog-admin" },
        { title: "Categorias", url: "/blog-admin/categories" },
        { title: "Comentários", url: "/blog-admin/comments" },
        { title: "Métricas & Relatórios", url: "/blog-admin/reports" },
      ],
    },
    {
      title: "Configurações",
      url: "/settings",
      icon: GearSix,
      items: [
        { title: "Leads", url: "/settings/leads" },
        { title: "Clientes", url: "/settings/clients" },
        { title: "Membros", url: "/settings/members" },
      ],
    },
  ],
  ORGANIZER_ADMIN: [
    HOME_ITEM,
    {
      title: "Competições",
      url: "/competitions",
      icon: Trophy,
      defaultOpen: true,
      items: [
        { title: "Todas", url: "/competitions" },
        { title: "Relatórios", url: "/competitions/reports" },
        { title: "Configurações", url: "/competitions/settings" },
      ],
    },
    {
      title: "Configurações",
      url: "/settings",
      icon: GearSix,
      items: [
        { title: "Geral", url: "/settings" },
        { title: "Perfil", url: "/settings/profile" },
      ],
    },
  ],
  CLIENT: [
    HOME_ITEM,
    {
      title: "Posts",
      url: "/posts",
      icon: FilmSlate,
      items: [],
    },
    {
      title: "Comentários",
      url: "/client-comments",
      icon: ChatCircleText,
      items: [],
    },
    {
      title: "Downloads",
      url: "/client-downloads",
      icon: DownloadSimple,
      items: [],
    },
    {
      title: "Configurações",
      url: "/settings",
      icon: GearSix,
      items: [{ title: "Perfil", url: "/settings/profile" }],
    },
  ],
  CLIPPER: [
    HOME_ITEM,
    {
      title: "Competições",
      url: "/my-competitions",
      icon: Trophy,
      defaultOpen: true,
      items: [
        { title: "Ativas", url: "/my-competitions" },
        { title: "Histórico", url: "/my-competitions/history" },
        { title: "Cronograma", url: "/my-competitions/schedule" },
      ],
    },
    {
      title: "Aulas",
      url: "/classes",
      icon: GraduationCap,
      items: [],
    },
    {
      title: "Financeiro",
      url: "/financial",
      icon: Wallet,
      items: [],
    },
    {
      title: "Indicações",
      url: "/affiliates",
      icon: Handshake,
      items: [],
    },
    {
      title: "Discord",
      url: "https://discord.gg/f2eNVbYnzn",
      icon: DiscordLogo,
      items: [],
      external: true,
      iconClass: "text-[#5865F2]",
    },
    {
      title: "Clãs",
      url: "/clans",
      icon: Shield,
      items: [],
    },
    {
      title: "Configurações",
      url: "/settings",
      icon: GearSix,
      items: [
        { title: "Gerenciar Contas", url: "/settings/manage-accounts" },
        { title: "Perfil", url: "/settings/profile" },
      ],
    },
  ],
};

export function getMenuByRole(role: string): NavItem[] {
  return MENU_BY_ROLE[role] ?? MENU_BY_ROLE.CLIPPER!;
}
