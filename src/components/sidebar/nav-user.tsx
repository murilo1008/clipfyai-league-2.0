"use client"

import { useClerk, useUser } from "@clerk/nextjs"
import { CaretUpDown, GearSix, SignOut, UserCircle } from "@phosphor-icons/react"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { api } from "@/trpc/react"

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  ORGANIZER_ADMIN: "Organizador",
  CLIENT: "Cliente",
  CLIPPER: "Clipador",
}

export function NavUser() {
  const { user: clerkUser } = useUser()
  const { signOut } = useClerk()
  const { isMobile } = useSidebar()
  const { data: dbUser } = api.user.getCurrentUser.useQuery()

  const name =
    dbUser?.name ?? clerkUser?.fullName ?? clerkUser?.username ?? "Usuário"
  const email =
    dbUser?.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? ""
  const imageUrl = dbUser?.imageUrl ?? clerkUser?.imageUrl
  const roleLabel = dbUser?.role ? ROLE_LABELS[dbUser.role] : undefined
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <SidebarFooter className="border-sidebar-border/60 border-t pb-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              >
                <Avatar className="ring-sidebar-border size-8 rounded-lg ring-1">
                  <AvatarImage src={imageUrl ?? undefined} alt={name} />
                  <AvatarFallback className="bg-gradient-custom rounded-lg text-xs font-semibold text-[#04222A]">
                    {initials || "CL"}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {roleLabel ?? email}
                  </span>
                </span>
                <CaretUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={8}
              className="w-56 rounded-xl"
            >
              <DropdownMenuLabel className="p-0">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={imageUrl ?? undefined} alt={name} />
                    <AvatarFallback className="bg-gradient-custom rounded-lg text-xs font-semibold text-[#04222A]">
                      {initials || "CL"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="cursor-pointer">
                    <UserCircle className="size-4" />
                    Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <GearSix className="size-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onClick={() => void signOut({ redirectUrl: "/sign-in" })}
              >
                <SignOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
