import Competition from "./competition"

export default async function CompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; announcement?: string }>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  return (
    <Competition
      slug={slug}
      initialTab={query.tab === "announcements" ? "announcements" : "posts"}
      initialAnnouncementId={
        typeof query.announcement === "string" ? query.announcement : undefined
      }
    />
  )
}
