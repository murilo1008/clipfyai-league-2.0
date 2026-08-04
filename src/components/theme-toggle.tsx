"use client"

import * as React from "react"
import { MoonStars, Sun } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === "dark" : true

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      className="text-muted-foreground hover:text-foreground size-8 cursor-pointer"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="size-4.5" weight="duotone" />
      ) : (
        <MoonStars className="size-4.5" weight="duotone" />
      )}
    </Button>
  )
}
