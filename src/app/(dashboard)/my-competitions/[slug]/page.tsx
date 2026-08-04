import Competition from "./competition"

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <Competition slug={slug} />
}
