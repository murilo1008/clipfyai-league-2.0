import "@/styles/globals.css"

import { type Metadata } from "next"
import { Geologica } from "next/font/google"

import { ptBR } from "@clerk/localizations"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "next-themes"

import { Toaster } from "@/components/ui/sonner"
import { FinancialVisibilityProvider } from "@/contexts/financial-visibility-context"
import { TRPCReactProvider } from "@/trpc/react"

export const metadata: Metadata = {
  title: "Clipfy League",
  description: "Plataforma de competições de cortes",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
}

const geologica = Geologica({
  subsets: ["latin"],
  variable: "--font-geologica-sans",
})

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR" className={geologica.variable} suppressHydrationWarning>
        <body suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <TRPCReactProvider>
              <FinancialVisibilityProvider>{children}</FinancialVisibilityProvider>
            </TRPCReactProvider>
            <Toaster richColors closeButton />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
