"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { useUser } from "@clerk/nextjs"
import {
  ArrowRight,
  BookOpen,
  CaretDown,
  CaretRight,
  ChatCircle,
  CircleNotch,
  Clock,
  Eye,
  Flame,
  Funnel,
  Heart,
  Lightning,
  MagnifyingGlass,
  Newspaper,
  PushPin,
  Sparkle,
  Star,
  Tag,
  User,
  X,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Logo } from "@/components/logo"
import { DarkScope } from "@/components/shared/dark-scope"
import { Bone } from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

type PublicPost = RouterOutputs["blog"]["getPublicPosts"]["posts"][number]

// ============================================================================
// HOOKS
// ============================================================================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// ============================================================================
// SKELETON INICIAL (só no primeiro load) — kit Bone da marca
// ============================================================================
function BlogHomeSkeleton() {
  return (
    <DarkScope className="contents">
      <div className="bg-background text-foreground min-h-screen">
        {/* Navbar fantasma */}
        <nav className="border-border/60 bg-background/70 sticky top-0 z-50 border-b backdrop-blur-2xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Bone className="h-7 w-28 rounded-md" />
              <div className="bg-border/60 h-6 w-px" />
              <Bone delay={80} className="h-4 w-10 rounded-md" />
            </div>
            <Bone delay={160} className="size-8 rounded-full" />
          </div>
        </nav>

        {/* Hero fantasma */}
        <div className="relative overflow-hidden">
          <div className="bg-grid-pattern absolute inset-0 -z-10 opacity-60" />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -z-[5] h-[300px] w-[min(600px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
              <Bone className="h-7 w-52 rounded-full" />
              <div className="flex w-full flex-col items-center gap-3">
                <Bone delay={100} className="h-11 w-4/5 sm:h-14" />
                <Bone delay={180} className="h-11 w-3/5 sm:h-14" />
              </div>
              <Bone delay={260} className="h-5 w-3/4 rounded-md" />
              <Bone delay={340} className="h-13 w-full max-w-lg rounded-2xl" />
              <div className="flex justify-center gap-8 pt-2">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <Bone delay={400 + index * 80} className="size-4 rounded" />
                    <Bone
                      delay={440 + index * 80}
                      className="h-3 w-16 rounded"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pills de categorias fantasma */}
        <div className="mx-auto max-w-7xl overflow-hidden px-4 pb-10 sm:px-6 lg:px-8">
          <div className="flex gap-2.5">
            {Array.from({ length: 7 }).map((_, index) => (
              <span
                key={index}
                aria-hidden
                className="skeleton-bone block h-10 shrink-0 rounded-full"
                style={
                  {
                    width: `${75 + index * 12}px`,
                    "--shimmer-delay": `${index * 90}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>

        {/* Destaque fantasma */}
        <div className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <FeaturedSkeleton />
        </div>

        {/* Header + grid fantasma */}
        <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <Bone className="size-11 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={80} className="h-5 w-36 rounded" />
              <Bone delay={160} className="h-3 w-44 rounded" />
            </div>
          </div>
          <PostsGridSkeleton />
        </div>
      </div>
    </DarkScope>
  )
}

// ============================================================================
// SKELETON DO GRID (filtro/busca em andamento)
// ============================================================================
function PostsGridSkeleton() {
  return (
    <div className="animate-fade-in grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="glass-card flex flex-col overflow-hidden rounded-3xl"
        >
          <Bone delay={index * 120} className="h-52 w-full rounded-none" />
          <div className="flex flex-col gap-3 p-5">
            <div className="flex gap-2">
              <Bone delay={index * 120 + 60} className="h-5 w-20 rounded-full" />
              <Bone
                delay={index * 120 + 120}
                className="h-5 w-16 rounded-full"
              />
            </div>
            <Bone delay={index * 120 + 180} className="h-5 w-full rounded" />
            <Bone delay={index * 120 + 220} className="h-5 w-3/4 rounded" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={index * 120 + 260} className="h-3.5 w-full rounded" />
              <Bone delay={index * 120 + 300} className="h-3.5 w-2/3 rounded" />
            </div>
            <div className="border-border/60 flex items-center justify-between border-t pt-3">
              <div className="flex gap-4">
                <Bone delay={index * 120 + 340} className="h-3 w-10 rounded" />
                <Bone delay={index * 120 + 380} className="h-3 w-10 rounded" />
                <Bone delay={index * 120 + 420} className="h-3 w-10 rounded" />
              </div>
              <Bone delay={index * 120 + 460} className="h-3 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// SKELETON DO DESTAQUE
// ============================================================================
function FeaturedSkeleton() {
  return (
    <div className="glass-card overflow-hidden rounded-3xl">
      <div className="grid md:grid-cols-5">
        <div className="relative aspect-video overflow-hidden md:col-span-3">
          <Bone className="absolute inset-0 rounded-none" />
          <div className="absolute top-4 left-4 flex gap-2">
            <Bone delay={120} className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6 md:col-span-2 md:p-10">
          <div className="flex gap-2">
            <Bone className="h-6 w-24 rounded-full" />
            <Bone delay={80} className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Bone delay={160} className="h-8 w-full" />
            <Bone delay={220} className="h-8 w-3/4" />
          </div>
          <div className="flex flex-col gap-2">
            <Bone delay={280} className="h-4 w-full rounded" />
            <Bone delay={340} className="h-4 w-5/6 rounded" />
          </div>
          <div className="flex items-center gap-3 pt-4">
            <Bone delay={400} className="size-10 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={460} className="h-4 w-28 rounded" />
              <Bone delay={520} className="h-3 w-24 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function BlogHome() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(
    null,
  )
  const [isInitialLoad, setIsInitialLoad] = React.useState(true)
  const { user, isLoaded: isUserLoaded } = useUser()

  // Debounce da busca para não disparar a cada tecla
  const debouncedSearch = useDebounce(searchQuery, 400)

  // Paginação real por cursor (nextCursor do router)
  const {
    data: postsData,
    isLoading: isLoadingPosts,
    isFetching: isFetchingPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.blog.getPublicPosts.useInfiniteQuery(
    {
      categorySlug: selectedCategory ?? undefined,
      search: debouncedSearch || undefined,
      limit: 12,
    },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  )
  const { data: categories, isLoading: isLoadingCategories } =
    api.blog.getPublicCategories.useQuery()
  const { data: publicStats } = api.blog.getPublicStats.useQuery()

  const posts = React.useMemo(
    () => postsData?.pages.flatMap((page) => page.posts) ?? [],
    [postsData],
  )

  // Diferencia primeiro load de refetch
  React.useEffect(() => {
    if (!isLoadingPosts && !isLoadingCategories) {
      setIsInitialLoad(false)
    }
  }, [isLoadingPosts, isLoadingCategories])

  // Área de conteúdo carregando (sem contar o "carregar mais")
  const isContentLoading =
    isFetchingPosts && !isInitialLoad && !isFetchingNextPage

  // Post em destaque (só sem filtro/busca ativos)
  const featuredPost = React.useMemo(() => {
    if (!selectedCategory && !debouncedSearch) {
      return posts.find((p) => p.isFeatured || p.isPinned) || null
    }
    return null
  }, [posts, selectedCategory, debouncedSearch])

  const gridPosts = React.useMemo(() => {
    if (featuredPost) {
      return posts.filter((p) => p.id !== featuredPost.id)
    }
    return posts
  }, [posts, featuredPost])

  // Skeleton completo só no primeiríssimo load
  if (isInitialLoad && (isLoadingPosts || isLoadingCategories)) {
    return <BlogHomeSkeleton />
  }

  return (
    <DarkScope className="contents">
      <div className="bg-background text-foreground min-h-screen">
        {/* ============================================================ */}
        {/* NAVBAR */}
        {/* ============================================================ */}
        <nav className="border-border/60 bg-background/70 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur-2xl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link href="/blog" className="group flex items-center gap-3">
                <Logo width={120} height={30} shadow={false} />
                <div className="bg-border/80 h-6 w-px" />
                <span className="text-muted-foreground group-hover:text-foreground text-sm font-semibold transition-colors">
                  Blog
                </span>
              </Link>

              <div className="flex items-center gap-2 sm:gap-3">
                {isUserLoaded && user ? (
                  <Link href="/">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 cursor-pointer rounded-full"
                    >
                      {user.imageUrl ? (
                        <div className="ring-brand-cyan/30 hover:ring-brand-cyan/60 size-7 overflow-hidden rounded-full ring-2 transition-all">
                          <Image
                            src={user.imageUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="bg-gradient-custom ring-brand-cyan/30 flex size-7 items-center justify-center rounded-full ring-2">
                          <User className="size-3.5 text-[#04222A]" weight="fill" />
                        </div>
                      )}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/sign-in">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground cursor-pointer text-xs sm:text-sm"
                      >
                        Entrar
                      </Button>
                    </Link>
                    <Link href="/sign-up?ref=blog">
                      <Button
                        size="sm"
                        className="btn-gradient-auth cursor-pointer rounded-lg text-xs font-semibold sm:text-sm"
                      >
                        Cadastre-se
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* ============================================================ */}
        {/* HERO */}
        {/* ============================================================ */}
        <section className="relative isolate overflow-hidden">
          {/* Imagem de fundo */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/blog/blog-home.png"
              alt=""
              fill
              className="object-cover object-center"
              priority
              quality={100}
              sizes="100vw"
            />
          </div>

          {/* Camadas petróleo para legibilidade */}
          <div className="absolute inset-0 z-[1] bg-[#030d18]/80" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#030d18]/50 via-[#030d18]/70 to-[#030d18]" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#030d18]/40 via-transparent to-[#030d18]/40" />

          {/* Glows da marca */}
          <div className="pointer-events-none absolute inset-0 z-[2]">
            <span className="absolute top-0 left-1/4 size-[30rem] rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_7%,transparent)] blur-3xl" />
            <span className="absolute right-1/4 bottom-0 size-[30rem] rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_6%,transparent)] blur-3xl" />
            <span className="absolute top-1/2 left-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_4%,transparent)] blur-3xl" />
          </div>

          {/* Vinheta */}
          <div className="absolute inset-0 z-[2] pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_30%,#030d18_100%)]" />

          {/* Grid fino da apresentação */}
          <div className="bg-grid-pattern absolute inset-0 z-[2] pointer-events-none opacity-70" />

          <div className="relative z-[3] mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 md:py-28 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-6 text-center sm:space-y-8">
              {/* Badge */}
              <div className="border-brand-cyan/25 text-brand-cyan mx-auto inline-flex items-center gap-2 rounded-full border bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] px-4 py-2 text-xs font-medium backdrop-blur-sm">
                <Sparkle className="size-3.5" weight="fill" />
                <span>{publicStats?.totalPosts || 0} artigos publicados</span>
                <div className="bg-brand-cyan/30 h-3 w-px" />
                <span className="text-brand-mint/80">para clipadores</span>
              </div>

              {/* Título */}
              <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Central do <span className="text-gradient">Clipador</span>
              </h1>

              {/* Subtítulo */}
              <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed sm:text-lg md:text-xl">
                Dicas, tutoriais, tendências e estratégias para clipadores
                dominarem as redes sociais e transformarem
                <span className="text-foreground font-medium">
                  {" "}
                  cortes em resultados
                </span>
                .
              </p>

              {/* Busca */}
              <div className="group relative mx-auto max-w-lg">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)] to-[color-mix(in_oklab,var(--brand-green)_25%,transparent)] opacity-0 blur-sm transition-opacity duration-500 group-focus-within:opacity-100" />
                <div className="relative flex items-center">
                  {isContentLoading && debouncedSearch ? (
                    <CircleNotch className="text-brand-cyan absolute top-1/2 left-4 size-4 -translate-y-1/2 animate-spin" />
                  ) : (
                    <MagnifyingGlass className="text-muted-foreground/60 group-focus-within:text-brand-cyan absolute top-1/2 left-4 size-4 -translate-y-1/2 transition-colors" />
                  )}
                  <Input
                    placeholder="Buscar artigos, dicas, tutoriais..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border-border/80 bg-card/80 focus-visible:border-brand-cyan/40 focus-visible:ring-brand-cyan/30 placeholder:text-muted-foreground/40 h-13 rounded-2xl pr-11 pl-11 text-base shadow-2xl shadow-black/20 backdrop-blur-xl transition-all sm:h-14"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer rounded-full p-1 transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats rápidas */}
              <div className="border-border/60 bg-card/30 mx-auto flex w-fit items-center justify-center gap-4 rounded-2xl border px-5 py-3 backdrop-blur-sm sm:gap-8">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                  <div className="rounded-md bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] p-1">
                    <Newspaper className="text-brand-cyan size-3 sm:size-3.5" />
                  </div>
                  <span className="text-foreground font-bold">
                    {publicStats?.totalPosts || 0}
                  </span>
                  <span className="hidden sm:inline">posts</span>
                </div>
                <div className="bg-border/80 h-4 w-px" />
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                  <div className="rounded-md bg-[color-mix(in_oklab,var(--brand-mint)_12%,transparent)] p-1">
                    <BookOpen className="text-brand-mint size-3 sm:size-3.5" />
                  </div>
                  <span className="text-foreground font-bold">
                    {publicStats?.totalCategories || 0}
                  </span>
                  <span className="hidden sm:inline">categorias</span>
                </div>
                <div className="bg-border/80 h-4 w-px" />
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                  <div className="rounded-md bg-[color-mix(in_oklab,var(--brand-green)_12%,transparent)] p-1">
                    <Eye className="text-brand-green size-3 sm:size-3.5" />
                  </div>
                  <span className="text-foreground font-bold">
                    {formatNumber(publicStats?.totalViews || 0)}
                  </span>
                  <span className="hidden sm:inline">views</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* CATEGORIAS */}
        {/* ============================================================ */}
        {categories && categories.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14 lg:px-8">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:gap-2.5 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {/* Pill "Todos" */}
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 sm:px-5 sm:py-2.5 sm:text-sm",
                  !selectedCategory
                    ? "bg-gradient-custom scale-[1.02] font-semibold text-[#04222A] shadow-[0_10px_30px_-8px_rgba(20,247,254,0.45)]"
                    : "border-border/80 bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground border backdrop-blur-sm",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Lightning
                    weight="fill"
                    className={cn(
                      "size-3 sm:size-3.5",
                      !selectedCategory ? "text-[#04222A]" : "text-brand-cyan",
                    )}
                  />
                  Todos
                </span>
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === cat.slug ? null : cat.slug,
                    )
                  }
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 sm:px-5 sm:py-2.5 sm:text-sm",
                    selectedCategory === cat.slug
                      ? "scale-[1.02] text-white shadow-lg"
                      : "border-border/80 bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground border backdrop-blur-sm",
                  )}
                  style={
                    selectedCategory === cat.slug
                      ? {
                          backgroundColor: cat.color || "#14f7fe",
                          boxShadow: `0 10px 30px -5px ${cat.color || "#14f7fe"}35`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      "size-2 rounded-full transition-transform",
                      selectedCategory === cat.slug ? "scale-125" : "",
                    )}
                    style={{
                      backgroundColor:
                        selectedCategory === cat.slug
                          ? "#fff"
                          : cat.color || "#888",
                    }}
                  />
                  {cat.title}
                  {cat.postsCount > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        selectedCategory === cat.slug
                          ? "bg-white/25"
                          : "bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {cat.postsCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* FILTROS ATIVOS / INDICADOR DE BUSCA */}
        {/* ============================================================ */}
        {(debouncedSearch || selectedCategory) && (
          <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Funnel className="size-3.5" />
                <span>Filtros ativos:</span>
              </div>

              {selectedCategory && (
                <Badge
                  variant="outline"
                  className="hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive cursor-pointer gap-1.5 text-xs transition-all"
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    borderColor: `${categories?.find((c) => c.slug === selectedCategory)?.color || "#14f7fe"}50`,
                    backgroundColor: `${categories?.find((c) => c.slug === selectedCategory)?.color || "#14f7fe"}10`,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        categories?.find((c) => c.slug === selectedCategory)
                          ?.color || "#14f7fe",
                    }}
                  />
                  {categories?.find((c) => c.slug === selectedCategory)?.title}
                  <X className="ml-0.5 size-3 opacity-60" />
                </Badge>
              )}

              {debouncedSearch && (
                <Badge
                  variant="outline"
                  className="border-border hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive cursor-pointer gap-1.5 text-xs transition-all"
                  onClick={() => setSearchQuery("")}
                >
                  <MagnifyingGlass className="size-3" />
                  &quot;{debouncedSearch}&quot;
                  <X className="ml-0.5 size-3 opacity-60" />
                </Badge>
              )}

              {/* Contagem de resultados + loading */}
              <div className="ml-auto flex items-center gap-2">
                {isContentLoading && (
                  <CircleNotch className="text-brand-cyan size-3.5 animate-spin" />
                )}
                <span className="text-muted-foreground text-xs">
                  {isContentLoading
                    ? "Buscando..."
                    : `${posts.length} ${posts.length === 1 ? "resultado" : "resultados"}`}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* POST EM DESTAQUE */}
        {/* ============================================================ */}
        {!selectedCategory && !debouncedSearch && (
          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-16 lg:px-8">
            {isContentLoading && !featuredPost ? (
              <FeaturedSkeleton />
            ) : featuredPost ? (
              <Link href={`/blog/${featuredPost.slug}`} className="group block">
                <div className="glass-card glass-card-hover relative overflow-hidden rounded-3xl">
                  {/* Elementos decorativos */}
                  <span
                    aria-hidden
                    className="absolute top-0 right-0 -mt-40 -mr-40 size-80 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_4%,transparent)] transition-transform duration-1000 group-hover:scale-150"
                  />
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 -mb-28 -ml-28 size-60 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_4%,transparent)] transition-transform delay-100 duration-1000 group-hover:scale-125"
                  />

                  <div className="relative grid md:grid-cols-5">
                    {/* Imagem */}
                    <div className="relative aspect-[16/10] overflow-hidden md:col-span-3 md:aspect-auto">
                      {featuredPost.coverImageUrl ? (
                        <>
                          <Image
                            src={featuredPost.coverImageUrl}
                            alt={featuredPost.title}
                            fill
                            className="object-cover transition-transform duration-1000 group-hover:scale-[1.04]"
                            sizes="(max-width: 768px) 100vw, 60vw"
                          />
                          <div className="to-card/90 absolute inset-0 hidden bg-gradient-to-r from-transparent via-transparent md:block" />
                          <div className="from-card via-card/20 absolute inset-0 bg-gradient-to-t to-transparent md:hidden" />
                        </>
                      ) : (
                        <div className="flex h-full min-h-[200px] items-center justify-center bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] to-[color-mix(in_oklab,var(--brand-green)_5%,transparent)]">
                          <div className="relative">
                            <Newspaper className="text-brand-cyan/20 size-20" />
                            <Sparkle
                              className="text-brand-cyan/30 absolute -top-2 -right-2 size-6"
                              weight="fill"
                            />
                          </div>
                        </div>
                      )}

                      {/* Badges flutuando na imagem */}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {featuredPost.isFeatured && (
                          <Badge className="border-0 bg-amber-500/90 text-xs text-white shadow-lg shadow-amber-500/20 backdrop-blur-sm">
                            <Star className="mr-1 size-3" weight="fill" />
                            Destaque
                          </Badge>
                        )}
                        {featuredPost.isPinned && (
                          <Badge className="border-0 bg-blue-500/90 text-xs text-white shadow-lg shadow-blue-500/20 backdrop-blur-sm">
                            <PushPin className="mr-1 size-3" weight="fill" />
                            Fixado
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="relative flex flex-col justify-center space-y-4 p-6 sm:space-y-5 sm:p-8 md:col-span-2 md:p-10">
                      {/* Categoria + tempo de leitura */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {featuredPost.category && (
                          <Badge
                            variant="outline"
                            className="border text-xs font-medium"
                            style={{
                              backgroundColor: `${featuredPost.category.color}12`,
                              color: featuredPost.category.color || "#888",
                              borderColor: `${featuredPost.category.color}35`,
                            }}
                          >
                            <Tag className="mr-1 size-3" />
                            {featuredPost.category.title}
                          </Badge>
                        )}
                        {featuredPost.readTimeMinutes && (
                          <span className="text-muted-foreground/70 flex items-center gap-1 text-xs">
                            <Clock className="size-3" />
                            {featuredPost.readTimeMinutes} min de leitura
                          </span>
                        )}
                      </div>

                      {/* Título */}
                      <h2 className="group-hover:text-gradient text-xl leading-tight font-extrabold tracking-tight transition-all duration-500 sm:text-2xl md:text-3xl">
                        {featuredPost.title}
                      </h2>

                      {/* Excerpt */}
                      {featuredPost.excerpt && (
                        <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed sm:text-base">
                          {featuredPost.excerpt}
                        </p>
                      )}

                      {/* Autor */}
                      <div className="flex items-center justify-between pt-4 sm:pt-5">
                        <div className="flex items-center gap-3">
                          {featuredPost.author?.imageUrl ? (
                            <Image
                              src={featuredPost.author.imageUrl}
                              alt={featuredPost.author.name || ""}
                              width={36}
                              height={36}
                              className="ring-border/60 rounded-full ring-2"
                            />
                          ) : (
                            <div className="bg-gradient-custom ring-border/60 flex size-9 items-center justify-center rounded-full ring-2">
                              <User
                                className="size-4 text-[#04222A]"
                                weight="fill"
                              />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold">
                              {featuredPost.author?.name || "Clipfy"}
                            </p>
                            {featuredPost.publishedAt && (
                              <p className="text-muted-foreground/70 text-xs">
                                {format(
                                  new Date(featuredPost.publishedAt),
                                  "d 'de' MMMM, yyyy",
                                  { locale: ptBR },
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Barra de métricas */}
                      <div className="border-border/60 flex items-center justify-between border-t pt-4">
                        <div className="text-muted-foreground/70 flex items-center gap-4">
                          <span className="flex items-center gap-1 text-xs">
                            <Eye className="size-3.5 text-sky-400" />
                            {formatNumber(featuredPost.viewsCount)}
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            <Heart className="size-3.5 text-pink-400" />
                            {formatNumber(featuredPost.likesCount)}
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            <ChatCircle className="size-3.5 text-violet-400" />
                            {formatNumber(featuredPost.commentsCount)}
                          </span>
                        </div>

                        <span className="text-brand-cyan flex items-center gap-1.5 text-sm font-semibold transition-all duration-500 group-hover:gap-2.5">
                          Ler artigo
                          <ArrowRight className="size-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ) : null}
          </section>
        )}

        {/* ============================================================ */}
        {/* GRID DE POSTS */}
        {/* ============================================================ */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          {/* Header da seção */}
          {!debouncedSearch && !selectedCategory && (
            <div className="mb-8 flex items-center justify-between sm:mb-10">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-custom rounded-xl p-2.5 shadow-[0_8px_24px_-10px_rgba(20,247,254,0.5)]">
                  <Flame className="size-5 text-[#04222A]" weight="fill" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                    Últimos Artigos
                  </h2>
                  <p className="text-muted-foreground/70 text-xs sm:text-sm">
                    Conteúdo fresco para clipadores
                  </p>
                </div>
              </div>

              {isContentLoading && (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <CircleNotch className="text-brand-cyan size-3.5 animate-spin" />
                  Atualizando...
                </div>
              )}
            </div>
          )}

          {/* Área de conteúdo */}
          <div className="relative">
            {/* Barra de progresso nos updates parciais */}
            {isContentLoading && (
              <div className="pointer-events-none absolute inset-0 z-10">
                <div className="bg-gradient-custom absolute top-0 right-0 left-0 h-1 animate-pulse rounded-full" />
              </div>
            )}

            {isContentLoading && posts.length === 0 ? (
              <PostsGridSkeleton />
            ) : gridPosts.length === 0 && !isContentLoading ? (
              <div className="glass-card relative overflow-hidden rounded-3xl">
                <span
                  aria-hidden
                  className="absolute top-0 right-0 -mt-24 -mr-24 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_4%,transparent)]"
                />
                <span
                  aria-hidden
                  className="absolute bottom-0 left-0 -mb-16 -ml-16 size-32 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_4%,transparent)]"
                />
                <div className="relative flex flex-col items-center justify-center py-20 text-center sm:py-24">
                  <div className="relative mb-5">
                    <div className="rounded-2xl bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-cyan)_15%,transparent)] to-[color-mix(in_oklab,var(--brand-green)_10%,transparent)] p-5">
                      <MagnifyingGlass className="text-brand-cyan/50 size-8" />
                    </div>
                    <div className="border-border bg-card absolute -right-1 -bottom-1 rounded-full border p-1.5">
                      <X className="text-muted-foreground size-3.5" />
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-bold sm:text-xl">
                    Nenhum artigo encontrado
                  </h3>
                  <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
                    {debouncedSearch
                      ? "Tente buscar com outros termos ou remova os filtros para ver todos os artigos."
                      : "Nenhum artigo nesta categoria ainda. Explore outras categorias!"}
                  </p>
                  {(debouncedSearch || selectedCategory) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10 hover:text-brand-cyan mt-6 cursor-pointer rounded-xl"
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedCategory(null)
                      }}
                    >
                      <X className="mr-1.5 size-3.5" />
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    "grid grid-cols-1 gap-5 transition-opacity duration-300 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3",
                    isContentLoading ? "opacity-60" : "opacity-100",
                  )}
                >
                  {gridPosts.map((post, index) => (
                    <PublicPostCard key={post.id} post={post} index={index} />
                  ))}
                </div>

                {/* Paginação real por cursor */}
                {hasNextPage && (
                  <div className="mt-10 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="h-11 cursor-pointer rounded-xl px-6 font-semibold"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <CircleNotch className="size-4 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <CaretDown className="size-4" weight="bold" />
                          Carregar mais artigos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* CTA NEWSLETTER */}
        {/* ============================================================ */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="glass-card relative overflow-hidden rounded-3xl">
            {/* Efeitos decorativos */}
            <span
              aria-hidden
              className="absolute top-0 right-0 -mt-32 -mr-32 size-64 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_5%,transparent)]"
            />
            <span
              aria-hidden
              className="absolute bottom-0 left-0 -mb-24 -ml-24 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_5%,transparent)]"
            />
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_3%,transparent)] blur-3xl"
            />

            <div className="relative px-6 py-12 sm:px-10 sm:py-16">
              <div className="mx-auto flex max-w-2xl flex-col items-center space-y-5 text-center">
                <div className="bg-gradient-custom rounded-2xl p-3 shadow-[0_12px_36px_-12px_rgba(20,247,254,0.55)]">
                  <Sparkle className="size-7 text-[#04222A]" weight="fill" />
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Quer virar um{" "}
                  <span className="text-gradient">clipador profissional</span>?
                </h3>
                <p className="text-muted-foreground max-w-lg text-sm leading-relaxed sm:text-base">
                  Cadastre-se na Clipfy e tenha acesso a competições exclusivas,
                  ferramentas de análise e uma comunidade de clipadores.
                </p>
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <Link href="/sign-up?ref=blog">
                    <Button className="btn-gradient-auth h-11 cursor-pointer rounded-xl px-6 font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-8px_rgba(55,250,156,0.5)] sm:px-8">
                      <Lightning className="mr-2 size-4" weight="fill" />
                      Começar Agora
                    </Button>
                  </Link>
                  <Link href="/landing-page">
                    <Button
                      variant="outline"
                      className="border-border text-muted-foreground hover:text-foreground h-11 w-full cursor-pointer rounded-xl sm:w-auto"
                    >
                      Sou Empresa
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* FOOTER */}
        {/* ============================================================ */}
        <footer className="border-border/60 bg-card/20 border-t">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:gap-0">
              <div className="flex items-center gap-3">
                <Logo width={100} height={25} shadow={false} />
                <div className="bg-border/80 h-5 w-px" />
                <span className="text-muted-foreground/70 text-xs font-medium sm:text-sm">
                  Central do Clipador
                </span>
              </div>

              <p className="text-muted-foreground/50 order-3 text-xs sm:order-2">
                © {new Date().getFullYear()} Clipfy. Todos os direitos
                reservados.
              </p>

              <div className="order-2 flex items-center gap-4 sm:order-3 sm:gap-6">
                <Link
                  href="/sign-up?ref=blog"
                  className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors sm:text-sm"
                >
                  Seja um Clipador
                </Link>
                <Link
                  href="/landing-page"
                  className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors sm:text-sm"
                >
                  Para Empresas
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </DarkScope>
  )
}

// ============================================================================
// CARD DE POST PÚBLICO
// ============================================================================
function PublicPostCard({ post, index }: { post: PublicPost; index: number }) {
  const catColor = post.category?.color || "#14f7fe"

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block h-full"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className="glass-card glass-card-hover relative flex h-full flex-col overflow-hidden rounded-3xl"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${catColor}06, transparent 40%)`,
        }}
      >
        {/* Elemento decorativo no hover */}
        <span
          aria-hidden
          className="absolute top-0 right-0 -mt-14 -mr-14 size-28 rounded-full opacity-0 transition-all duration-700 group-hover:scale-[2.5] group-hover:opacity-100"
          style={{ backgroundColor: `${catColor}06` }}
        />

        {/* Capa */}
        <div className="relative h-48 overflow-hidden sm:h-52">
          {post.coverImageUrl ? (
            <>
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="from-card absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-80" />
            </>
          ) : (
            <div className="from-muted/20 to-muted/5 flex h-full items-center justify-center bg-gradient-to-br">
              <Newspaper className="text-muted-foreground/15 size-10" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {post.isFeatured && (
              <Badge className="border-0 bg-amber-500/90 text-[10px] text-white shadow-lg shadow-amber-500/20 backdrop-blur-sm">
                <Star className="mr-1 size-2.5" weight="fill" />
                Destaque
              </Badge>
            )}
            {post.isPinned && (
              <Badge className="border-0 bg-blue-500/90 text-[10px] text-white shadow-lg shadow-blue-500/20 backdrop-blur-sm">
                <PushPin className="mr-1 size-2.5" weight="fill" />
                Fixado
              </Badge>
            )}
          </div>

          {/* Tempo de leitura na imagem */}
          {post.readTimeMinutes && (
            <div className="absolute right-3 bottom-3">
              <Badge className="border-0 bg-black/50 text-[10px] font-normal text-white/80 backdrop-blur-md">
                <Clock className="mr-1 size-2.5" />
                {post.readTimeMinutes} min
              </Badge>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="relative flex flex-1 flex-col space-y-3 p-5">
          {/* Categoria */}
          <div className="flex flex-wrap items-center gap-2">
            {post.category && (
              <Badge
                variant="outline"
                className="border text-[10px] font-medium"
                style={{
                  backgroundColor: `${catColor}10`,
                  color: catColor,
                  borderColor: `${catColor}30`,
                }}
              >
                <Tag className="mr-1 size-2.5" />
                {post.category.title}
              </Badge>
            )}
          </div>

          {/* Título */}
          <h3 className="group-hover:text-gradient line-clamp-2 text-[15px] leading-snug font-bold transition-all duration-500">
            {post.title}
          </h3>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-muted-foreground/80 line-clamp-2 flex-1 text-sm leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Autor + data */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2">
              {post.author?.imageUrl ? (
                <Image
                  src={post.author.imageUrl}
                  alt={post.author.name || ""}
                  width={22}
                  height={22}
                  className="ring-border/60 rounded-full ring-1"
                />
              ) : (
                <div className="bg-gradient-custom ring-border/60 flex size-5.5 items-center justify-center rounded-full ring-1">
                  <User className="size-3 text-[#04222A]" weight="fill" />
                </div>
              )}
              <span className="text-muted-foreground/70 text-[11px] font-medium">
                {post.author?.name || "Clipfy"}
              </span>
            </div>
            {post.publishedAt && (
              <span className="text-muted-foreground/50 text-[10px]">
                {format(new Date(post.publishedAt), "d MMM yyyy", {
                  locale: ptBR,
                })}
              </span>
            )}
          </div>

          {/* Métricas */}
          <div className="border-border/60 text-muted-foreground/60 flex items-center gap-4 border-t pt-3">
            <span className="flex items-center gap-1 text-[11px]">
              <Eye className="size-3 text-sky-400" />
              {formatNumber(post.viewsCount)}
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <Heart className="size-3 text-pink-400" />
              {formatNumber(post.likesCount)}
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <ChatCircle className="size-3 text-violet-400" />
              {formatNumber(post.commentsCount)}
            </span>
            <span className="text-brand-cyan ml-auto flex translate-x-1 items-center gap-1 text-[11px] font-semibold opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
              Ler <CaretRight className="size-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ============================================================================
// UTILS
// ============================================================================
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}
