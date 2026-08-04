"use client"

import Image from "next/image"
import Link from "next/link"

import { Logo } from "@/components/logo"
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarBrand() {
  return (
    <SidebarHeader className="border-sidebar-border/60 border-b px-2 py-3 group-data-[collapsible=icon]:px-0">
      <SidebarMenu>
        <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="Clipfy League"
            className="gap-2.5 overflow-visible hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center [&>span:last-child]:overflow-visible"
          >
            <Link href="/" aria-label="Ir para a home">
              {/* Ícone da marca — visível apenas colapsado, sem fundo (transparente) */}
              <span className="hidden w-fit shrink-0 group-data-[collapsible=icon]:block">
                <Image
                  src="/images/icon-clipfy.svg"
                  alt=""
                  width={22}
                  height={22}
                  className="h-5.5 w-auto"
                />
              </span>

              {/* Logo completa — some no modo colapsado */}
              <span className="flex min-w-0 flex-1 items-center overflow-visible group-data-[collapsible=icon]:hidden">
                <Logo
                  width={132}
                  height={33}
                  shadow={false}
                  className="h-8 w-auto dark:drop-shadow-[0_0_24px_rgba(20,247,254,0.35)]"
                />
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}
