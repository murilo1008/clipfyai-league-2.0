import CompetitionAdmin from "./competition-admin"

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <CompetitionAdmin slug={slug} />
}
