import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DashboardBackground } from "@/components/dashboard-background"
import { AppTopbar } from "@/components/header/app-topbar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { AuthTemplate } from "@/components/templates/auth-template"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export const metadata: Metadata = {
  title: "Clipfy League",
  description: "Clipfy League - Gerencie sua competição de cortes",
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthTemplate requireAuth={true}>
      <DashboardBackground />
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="bg-background dark:bg-background/70 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain dark:backdrop-blur-xl md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-sidebar-border md:peer-data-[variant=inset]:shadow-none dark:md:peer-data-[variant=inset]:shadow-[0_0_60px_-20px_rgba(20,247,254,0.18)]">
          <AppTopbar />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </AuthTemplate>
  )
}
