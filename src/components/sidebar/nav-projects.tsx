"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Trophy } from "@phosphor-icons/react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type ProjectItem = {
  name: string
  url: string
}

/**
 * "Em andamento" — competições ativas do usuário (dados reais do banco).
 */
export function NavProjects({ projects }: { projects: ProjectItem[] }) {
  const pathname = usePathname()

  if (projects.length === 0) return null

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-semibold tracking-[0.18em] uppercase">
        Em andamento
      </SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((project) => {
          const isActive = pathname === project.url.split("?")[0]
          return (
            <SidebarMenuItem key={project.url}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={project.name}>
                <Link href={project.url}>
                  <Trophy
                    className="text-brand-mint size-4 shrink-0"
                    weight={isActive ? "fill" : "duotone"}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
