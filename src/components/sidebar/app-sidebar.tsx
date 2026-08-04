"use client"

import * as React from "react"
import { Plus } from "@phosphor-icons/react"

import { CreatePostDialog } from "@/components/clippers/create-post-dialog"
import { NavMain } from "@/components/sidebar/nav-main"
import { NavProjects, type ProjectItem } from "@/components/sidebar/nav-projects"
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
            className="btn-gradient-auth h-9 cursor-pointer justify-center rounded-lg font-semibold text-[#04222A] hover:text-[#04222A] active:text-[#04222A] group-data-[collapsible=icon]:justify-center"
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

  const { data: user, isLoading: isLoadingUser } =
    api.user.getCurrentUser.useQuery()

  const isAdminLike = user?.role === "ADMIN" || user?.role === "ORGANIZER_ADMIN"

  // "Em andamento" — competições ativas conforme o role (dados reais)
  const { data: activeCampaigns } = api.campaign.getActive.useQuery(undefined, {
    enabled: isAdminLike,
  })
  const { data: clipperCompetitions } = api.clipper.getMyCompetitions.useQuery(
    undefined,
    { enabled: user?.role === "CLIPPER" },
  )
  const { data: clientDashboard } = api.customers.getDashboard.useQuery(
    undefined,
    { enabled: user?.role === "CLIENT" },
  )

  const navMain = user ? getMenuByRole(user.role) : []

  const projects: ProjectItem[] =
    user?.role === "CLIPPER"
      ? (clipperCompetitions?.map((competition: { name: string; slug: string }) => ({
          name: competition.name,
          url: `/my-competitions/${competition.slug}`,
        })) ?? [])
      : user?.role === "CLIENT"
        ? (clientDashboard?.campaigns?.map(
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
              <CreatePostButton onClick={() => setIsCreatePostOpen(true)} />
            )}
            <NavProjects projects={projects} />
          </React.Suspense>
        )}
      </SidebarContent>
      <NavUser />
      {user?.role === "CLIPPER" && (
        <CreatePostDialog
          open={isCreatePostOpen}
          onOpenChange={setIsCreatePostOpen}
        />
      )}
      <SidebarRail />
    </Sidebar>
  )
}
