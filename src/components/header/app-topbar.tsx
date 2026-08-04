"use client"

import * as React from "react"

import { AppBreadcrumbs } from "@/components/header/app-breadcrumbs"
import { FinancialVisibilityToggle } from "@/components/header/financial-visibility-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function AppTopbar() {
  return (
    <header className="bg-background/70 supports-[backdrop-filter]:bg-background/55 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-2 px-3 sm:px-4">
        <SidebarTrigger className="-ml-1 cursor-pointer" />
        <Separator
          orientation="vertical"
          className="mr-1 hidden data-[orientation=vertical]:h-5 data-[orientation=vertical]:self-center sm:block"
        />
        <div className="hidden min-w-0 md:block">
          <AppBreadcrumbs />
        </div>

        <div className="flex flex-1 items-center justify-end gap-1.5">
          <FinancialVisibilityToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
