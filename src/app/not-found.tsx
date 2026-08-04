import Link from "next/link"

import { DashboardBackground } from "@/components/dashboard-background"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 p-4 text-center">
      <DashboardBackground />
      <Logo width={160} height={40} />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-gradient text-6xl font-bold">404</h1>
        <p className="text-muted-foreground text-sm">
          A página que você procura não existe.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Voltar para o início</Link>
      </Button>
    </main>
  )
}
