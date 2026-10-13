"use client"

import dynamic from "next/dynamic"

import type { UserRole } from "@prisma/client"

// Cada papel vê uma home diferente. Com imports estáticos o navegador baixava
// as três (recharts do admin para o clipador, framer-motion do clipador para o
// admin...). O split precisa ficar num client component: `dynamic()` direto no
// Server Component não separa os chunks.
const Home = dynamic(() => import("./home"))
const HomeClient = dynamic(() => import("./home-client"))
const HomeClipper = dynamic(() => import("./home-clipper"))

export function HomeByRole({ role }: { role: UserRole | undefined }) {
  if (role === "CLIPPER") return <HomeClipper />
  if (role === "CLIENT") return <HomeClient />
  return <Home />
}
