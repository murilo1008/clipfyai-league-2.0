import { redirect } from "next/navigation"

import { auth } from "@clerk/nextjs/server"

import { db } from "@/server/db"

import SignUp from "./sign-up"
import SignUpCompetition from "./sign-up-competition"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; ref?: string }>
}) {
  const { userId } = await auth()

  if (userId) {
    redirect("/")
  }

  const params = await searchParams
  const slug = params.slug
  // `?ref=` é o código de afiliado gerado em /affiliates
  const affiliateCode = params.ref

  // Se tiver slug na URL, buscar dados da competição
  if (slug) {
    const campaign = await db.campaign.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverImageUrl: true,
        platforms: true,
        prizeInfo: true,
        startDate: true,
        endDate: true,
        status: true,
        client: {
          select: {
            name: true,
            imageUrl: true,
          },
        },
      },
    })

    // Se encontrou campanha com imagem de capa, renderizar layout especial
    if (campaign && campaign.coverImageUrl) {
      return (
        <SignUpCompetition
          affiliateCode={affiliateCode ?? null}
          campaign={{
            name: campaign.name,
            slug: campaign.slug,
            description: campaign.description,
            coverImageUrl: campaign.coverImageUrl,
            platforms: campaign.platforms,
            prizeInfo: campaign.prizeInfo as { totalPrize?: string | number } | null,
            startDate: campaign.startDate.toISOString(),
            endDate: campaign.endDate.toISOString(),
            status: campaign.status,
            clientName: campaign.client?.name ?? null,
            clientImageUrl: campaign.client?.imageUrl ?? null,
          }}
        />
      )
    }
  }

  return <SignUp />
}
