"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Plus } from "@phosphor-icons/react"

import { NavMain } from "@/components/sidebar/nav-main"
import {
  NavProjects,
  type ProjectItem,
} from "@/components/sidebar/nav-projects"
import { NavUser } from "@/components/sidebar/nav-user"
import { SidebarBrand } from "@/components/sidebar/sidebar-brand"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getMenuByRole } from "@/config/navigation"
import { api } from "@/trpc/react"

// Dialog de envio de posts: carregado sob demanda (só clipadores o abrem).
const CreatePostDialog = dynamic(
  () =>
    import("@/components/clippers/create-post-dialog").then(
      (m) => m.CreatePostDialog,
    ),
  { ssr: false },
)

function SidebarSkeleton() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {Array.from({ length: 6 }).map((_, index) => (
          <SidebarMenuItem key={index}>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/** Botão "Enviar Post" do clipador — compacto, colapsa junto com a sidebar. */
function CreatePostButton({ onClick }: { onClick: () => void }) {
  return (
    <SidebarGroup className="py-0">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Enviar Post"
            onClick={onClick}
            className="btn-gradient-auth h-9 cursor-pointer justify-center rounded-lg font-semibold text-[#04222A] group-data-[collapsible=icon]:justify-center hover:text-[#04222A] active:text-[#04222A]"
          >
            <Plus weight="bold" className="size-4 shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              Enviar Post
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [isCreatePostOpen, setIsCreatePostOpen] = React.useState(false)
  // Monta o dialog na primeira abertura e o mantém (animação de fechar e estado)
  const [hasOpenedCreatePost, setHasOpenedCreatePost] = React.useState(false)
  const openCreatePost = () => {
    setHasOpenedCreatePost(true)
    setIsCreatePostOpen(true)
  }

  const { data: user, isLoading: isLoadingUser } =
    api.user.getCurrentUser.useQuery()

  const isAdminLike = user?.role === "ADMIN" || user?.role === "ORGANIZER_ADMIN"

  // "Em andamento" — competições ativas conforme o role (dados reais)
  const { data: activeCampaigns } = api.campaign.getActive.useQuery(undefined, {
    enabled: isAdminLike,
  })
  // Só nome/slug para o menu (getMyCompetitions calcula métricas por campanha)
  const { data: clipperCompetitions } =
    api.clipper.getMyCompetitionOptions.useQuery(undefined, {
      enabled: user?.role === "CLIPPER",
      staleTime: 5 * 60_000,
      // O menu fica montado a sessão toda: voltar para a aba atualiza a lista
      // (inscrição aprovada pelo admin, competição encerrada).
      refetchOnWindowFocus: true,
    })
  // Só nomes e ids para o menu — o getDashboard completo roda ~13 queries
  // de métricas por campanha e era refeito em toda navegação.
  const { data: clientCampaigns } =
    api.customers.getMyCampaignOptions.useQuery(undefined, {
      enabled: user?.role === "CLIENT",
    })

  // Só muda quando o admin informa o investimento: sem polling.
  const { data: hasPerformance } = api.customers.hasPerformance.useQuery(
    undefined,
    { enabled: user?.role === "CLIENT", staleTime: 5 * 60_000 },
  )

  const navMain = user
    ? getMenuByRole(user.role).filter(
        (item) =>
          user.role !== "CLIENT" ||
          item.url !== "/performance" ||
          hasPerformance === true,
      )
    : []

  const projects: ProjectItem[] =
    user?.role === "CLIPPER"
      ? (clipperCompetitions?.map(
          (competition: { name: string; slug: string }) => ({
            name: competition.name,
            url: `/my-competitions/${competition.slug}`,
          }),
        ) ?? [])
      : user?.role === "CLIENT"
        ? (clientCampaigns?.map(
            (campaign: { name: string; id: string }) => ({
              name: campaign.name,
              url: `/posts?campaignId=${campaign.id}`,
            }),
          ) ?? [])
        : (activeCampaigns?.map((campaign: { name: string; slug: string }) => ({
            name: campaign.name,
            url: `/competitions/${campaign.slug}`,
          })) ?? [])

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarBrand />
      <SidebarContent>
        {isLoadingUser ? (
          <SidebarSkeleton />
        ) : (
          <React.Suspense fallback={<SidebarSkeleton />}>
            <NavMain items={navMain} />
            {user?.role === "CLIPPER" && (
              <CreatePostButton onClick={openCreatePost} />
            )}
            <NavProjects projects={projects} />
          </React.Suspense>
        )}
      </SidebarContent>
      <NavUser />
      {user?.role === "CLIPPER" && hasOpenedCreatePost && (
        <CreatePostDialog
          open={isCreatePostOpen}
          onOpenChange={setIsCreatePostOpen}
        />
      )}
      <SidebarRail />
    </Sidebar>
  )
}
