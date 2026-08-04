"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { useUser } from "@clerk/nextjs"
import {
  ArrowBendUpLeft,
  ArrowElbowDownRight,
  ArrowLeft,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretRight,
  CaretUp,
  ChatCircle,
  Check,
  CircleNotch,
  Clock,
  Copy,
  Eye,
  Heart,
  Lightning,
  Newspaper,
  PaperPlaneTilt,
  PushPin,
  ShareNetwork,
  SignIn,
  Sparkle,
  Star,
  Tag,
  Trash,
  User,
} from "@phosphor-icons/react"
import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import { Logo } from "@/components/logo"
import { DarkScope } from "@/components/shared/dark-scope"
import { Bone } from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

type PostComment = RouterOutputs["blog"]["getPostComments"][number]
type PostReply = PostComment["replies"][number]
type RelatedPostItem = RouterOutputs["blog"]["getRelatedPosts"][number]

// ============================================================================
// SKELETON — kit Bone da marca espelhando o layout do artigo
// ============================================================================
function BlogPostSkeleton() {
  return (
    <DarkScope className="contents">
      <div className="bg-background text-foreground min-h-screen">
        {/* Navbar fantasma */}
        <nav className="border-border/60 bg-background/70 sticky top-0 z-50 border-b backdrop-blur-2xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Bone className="size-8 rounded-lg" />
              <Bone delay={60} className="h-5 w-28 rounded-md" />
              <div className="bg-border/60 hidden h-6 w-px sm:block" />
              <Bone delay={120} className="hidden h-4 w-10 rounded-md sm:block" />
            </div>
            <div className="flex items-center gap-2">
              <Bone delay={180} className="hidden h-8 w-24 rounded-xl sm:block" />
              <Bone delay={240} className="size-8 rounded-full" />
            </div>
          </div>
        </nav>

        {/* Capa fantasma */}
        <div className="relative h-64 w-full overflow-hidden md:h-[28rem]">
          <Bone className="absolute inset-0 rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030d18] via-[#030d18]/30 to-transparent" />
        </div>

        {/* Artigo fantasma */}
        <div className="relative z-10 mx-auto -mt-20 max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-5">
            {/* Badges */}
            <div className="flex items-center gap-2">
              <Bone className="h-6 w-20 rounded-full" />
              <Bone delay={80} className="h-6 w-28 rounded-full" />
              <Bone delay={160} className="h-6 w-24 rounded-full" />
            </div>

            {/* Título */}
            <div className="space-y-3">
              <Bone delay={200} className="h-10 w-full sm:h-12" />
              <Bone delay={260} className="h-10 w-4/5 sm:h-12" />
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Bone delay={320} className="h-5 w-full rounded-md" />
              <Bone delay={380} className="h-5 w-3/4 rounded-md" />
            </div>

            {/* Autor + meta */}
            <div className="border-border/60 flex flex-col gap-4 border-y py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Bone delay={440} className="size-10 rounded-full" />
                <div className="space-y-1.5">
                  <Bone delay={500} className="h-4 w-28 rounded-md" />
                  <Bone delay={560} className="h-3 w-36 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Bone delay={620} className="h-7 w-14 rounded-lg" />
                <Bone delay={680} className="h-7 w-14 rounded-lg" />
                <Bone delay={740} className="h-7 w-14 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Corpo markdown fantasma */}
          <div className="space-y-6 py-10">
            <div className="space-y-2.5">
              {[100, 97, 100, 92, 88].map((w, i) => (
                <span
                  key={`p1-${i}`}
                  aria-hidden
                  className="skeleton-bone block h-4 rounded-md"
                  style={
                    {
                      width: `${w}%`,
                      "--shimmer-delay": `${i * 70}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            <Bone delay={100} className="mt-4 h-7 w-2/5" />

            <div className="space-y-2.5">
              {[100, 95, 100, 98, 85].map((w, i) => (
                <span
                  key={`p2-${i}`}
                  aria-hidden
                  className="skeleton-bone block h-4 rounded-md"
                  style={
                    {
                      width: `${w}%`,
                      "--shimmer-delay": `${i * 70}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            {/* Blockquote */}
            <div className="border-brand-cyan/20 my-2 border-l-4 py-2 pl-6">
              <Bone className="h-4 w-11/12 rounded-md" />
              <Bone delay={80} className="mt-2 h-4 w-3/4 rounded-md" />
            </div>

            <Bone delay={140} className="mt-4 h-7 w-1/3" />

            <div className="space-y-2.5">
              {[100, 93, 100, 96].map((w, i) => (
                <span
                  key={`p3-${i}`}
                  aria-hidden
                  className="skeleton-bone block h-4 rounded-md"
                  style={
                    {
                      width: `${w}%`,
                      "--shimmer-delay": `${i * 70}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            {/* Imagem inline */}
            <Bone delay={200} className="h-56 w-full rounded-xl sm:h-72" />

            <div className="space-y-2.5">
              {[100, 90, 97, 100, 82].map((w, i) => (
                <span
                  key={`p4-${i}`}
                  aria-hidden
                  className="skeleton-bone block h-4 rounded-md"
                  style={
                    {
                      width: `${w}%`,
                      "--shimmer-delay": `${i * 70}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>

          {/* Barra de engajamento */}
          <div className="border-border/60 border-y py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bone className="h-9 w-20 rounded-xl" />
                <Bone delay={80} className="h-9 w-28 rounded-xl" />
              </div>
              <div className="flex items-center gap-3">
                <Bone delay={160} className="h-4 w-10 rounded-md" />
                <Bone delay={240} className="h-4 w-10 rounded-md" />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="border-border/60 border-b py-8">
            <div className="mb-3 flex items-center gap-2">
              <Bone className="size-4 rounded" />
              <Bone delay={60} className="h-4 w-10 rounded" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[16, 20, 14, 18, 12].map((w, i) => (
                <span
                  key={`tag-${i}`}
                  aria-hidden
                  className="skeleton-bone block h-6 rounded-full"
                  style={
                    {
                      width: `${w * 4}px`,
                      "--shimmer-delay": `${i * 90}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>

          {/* Comentários */}
          <div className="space-y-6 py-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bone className="size-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Bone delay={60} className="h-5 w-28 rounded" />
                  <Bone delay={120} className="h-3 w-20 rounded" />
                </div>
              </div>
              <Bone delay={180} className="h-8 w-36 rounded-lg" />
            </div>

            <Bone delay={240} className="h-24 w-full rounded-xl" />

            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Bone delay={i * 120} className="size-9 min-w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Bone delay={i * 120 + 60} className="h-4 w-24 rounded" />
                    <Bone delay={i * 120 + 120} className="h-3 w-20 rounded" />
                  </div>
                  <Bone delay={i * 120 + 180} className="h-4 w-full rounded" />
                  <Bone delay={i * 120 + 240} className="h-4 w-2/3 rounded" />
                  <div className="flex gap-4 pt-1">
                    <Bone delay={i * 120 + 300} className="h-3 w-8 rounded" />
                    <Bone delay={i * 120 + 360} className="h-3 w-16 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer fantasma */}
        <div className="border-border/60 mt-10 border-t">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-10 sm:px-6 lg:px-8">
            <Bone className="h-6 w-32 rounded" />
            <Bone delay={100} className="h-4 w-48 rounded" />
            <Bone delay={200} className="hidden h-4 w-24 rounded sm:block" />
          </div>
        </div>
      </div>
    </DarkScope>
  )
}

// ============================================================================
// COMENTÁRIO
// ============================================================================
function CommentItem({
  comment,
  postId,
  currentUserId,
  onReply,
  isReply = false,
}: {
  comment: PostComment | PostReply
  postId: string
  currentUserId: string | null
  onReply: (commentId: string) => void
  isReply?: boolean
}) {
  const [showReplies, setShowReplies] = React.useState(true)
  const utils = api.useUtils()

  const replies = "replies" in comment ? comment.replies : undefined

  const toggleLike = api.blog.toggleCommentLike.useMutation({
    onSuccess: () => {
      void utils.blog.getPostComments.invalidate({ postId })
    },
    onError: () => toast.error("Faça login para curtir"),
  })

  const deleteComment = api.blog.deleteComment.useMutation({
    onSuccess: () => {
      void utils.blog.getPostComments.invalidate({ postId })
      toast.success("Comentário removido")
    },
    onError: (error) => toast.error(error.message),
  })

  const isOwnComment = currentUserId === comment.author.id

  return (
    <div className={cn("group", isReply && "ml-6 sm:ml-10")}>
      <div className="flex gap-3">
        {/* Avatar */}
        {comment.author.imageUrl ? (
          <div
            className={cn(
              "ring-border/60 mt-0.5 shrink-0 overflow-hidden rounded-full ring-2",
              isReply ? "size-7 min-w-7" : "size-9 min-w-9",
            )}
          >
            <Image
              src={comment.author.imageUrl}
              alt={comment.author.name || ""}
              width={isReply ? 28 : 36}
              height={isReply ? 28 : 36}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        ) : (
          <div
            className={cn(
              "bg-gradient-custom ring-border/60 mt-0.5 flex shrink-0 items-center justify-center rounded-full ring-2",
              isReply ? "size-7 min-w-7" : "size-9 min-w-9",
            )}
          >
            <User
              className={cn("text-[#04222A]", isReply ? "size-3.5" : "size-4")}
              weight="fill"
            />
          </div>
        )}

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-semibold", isReply ? "text-xs" : "text-sm")}>
              {comment.author.name || "Anônimo"}
            </span>
            {comment.isPinned && (
              <Badge className="border-0 bg-blue-500/15 px-1.5 py-0 text-[9px] text-blue-400">
                <PushPin className="mr-0.5 size-2" weight="fill" />
                Fixado
              </Badge>
            )}
            <span className="text-muted-foreground/50 text-[11px]">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
            {comment.editedAt && (
              <span className="text-muted-foreground/40 text-[10px] italic">
                (editado)
              </span>
            )}
          </div>

          {/* Texto */}
          <p
            className={cn(
              "text-muted-foreground mt-1 leading-relaxed break-words whitespace-pre-wrap",
              isReply ? "text-xs" : "text-sm",
            )}
          >
            {comment.content}
          </p>

          {/* Ações */}
          <div className="mt-2 flex items-center gap-3">
            {/* Curtir */}
            <button
              onClick={() => {
                if (!currentUserId) {
                  toast.error("Faça login para curtir comentários")
                  return
                }
                toggleLike.mutate({ commentId: comment.id })
              }}
              disabled={toggleLike.isPending}
              className={cn(
                "group/like flex cursor-pointer items-center gap-1 text-[11px] transition-all",
                comment.likedByMe
                  ? "font-semibold text-pink-500"
                  : "text-muted-foreground/50 hover:text-pink-500",
              )}
            >
              <Heart
                weight={comment.likedByMe ? "fill" : "regular"}
                className="size-3 transition-transform group-hover/like:scale-110"
              />
              {comment.likesCount > 0 && comment.likesCount}
            </button>

            {/* Responder (só no nível raiz) */}
            {!isReply && (
              <button
                onClick={() => {
                  if (!currentUserId) {
                    toast.error("Faça login para responder")
                    return
                  }
                  onReply(comment.id)
                }}
                className="text-muted-foreground/50 hover:text-brand-cyan flex cursor-pointer items-center gap-1 text-[11px] transition-all"
              >
                <ArrowBendUpLeft className="size-3" />
                Responder
              </button>
            )}

            {/* Excluir (próprios comentários) */}
            {isOwnComment && (
              <button
                onClick={() => deleteComment.mutate({ commentId: comment.id })}
                disabled={deleteComment.isPending}
                className="text-muted-foreground/30 flex cursor-pointer items-center gap-1 text-[11px] opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
              >
                {deleteComment.isPending ? (
                  <CircleNotch className="size-3 animate-spin" />
                ) : (
                  <Trash className="size-3" />
                )}
              </button>
            )}
          </div>

          {/* Respostas */}
          {!isReply && replies && replies.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-brand-cyan mb-2 flex cursor-pointer items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-80"
              >
                {showReplies ? (
                  <CaretUp className="size-3" />
                ) : (
                  <CaretDown className="size-3" />
                )}
                {replies.length} {replies.length === 1 ? "resposta" : "respostas"}
              </button>

              {showReplies && (
                <div className="border-border/60 space-y-4 border-l-2 pl-0">
                  {replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      postId={postId}
                      currentUserId={currentUserId}
                      onReply={onReply}
                      isReply
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SEÇÃO DE COMENTÁRIOS
// ============================================================================
function CommentsSection({
  postId,
  commentsCount,
  slug,
}: {
  postId: string
  commentsCount: number
  slug: string
}) {
  const [commentText, setCommentText] = React.useState("")
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null)
  const [replyText, setReplyText] = React.useState("")
  const [sortBy, setSortBy] = React.useState<"recent" | "popular">("recent")

  const utils = api.useUtils()

  const { data: likeData } = api.blog.checkPostLike.useQuery({ postId })
  const currentUserId = likeData?.userId || null

  const { data: comments, isLoading: isLoadingComments } =
    api.blog.getPostComments.useQuery({
      postId,
      sortBy,
    })

  const addComment = api.blog.addComment.useMutation({
    onSuccess: () => {
      setCommentText("")
      void utils.blog.getPostComments.invalidate({ postId })
      toast.success("Comentário adicionado!")
    },
    onError: (error) => {
      if (error.message.includes("Unauthorized")) {
        toast.error("Faça login para comentar")
      } else {
        toast.error(error.message)
      }
    },
  })

  const addReply = api.blog.addComment.useMutation({
    onSuccess: () => {
      setReplyText("")
      setReplyingTo(null)
      void utils.blog.getPostComments.invalidate({ postId })
      toast.success("Resposta adicionada!")
    },
    onError: (error) => {
      if (error.message.includes("Unauthorized")) {
        toast.error("Faça login para responder")
      } else {
        toast.error(error.message)
      }
    },
  })

  const handleSubmitComment = () => {
    if (!commentText.trim()) return
    addComment.mutate({ postId, content: commentText.trim() })
  }

  const handleSubmitReply = () => {
    if (!replyText.trim() || !replyingTo) return
    addReply.mutate({ postId, content: replyText.trim(), parentId: replyingTo })
  }

  const handleReply = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId)
    setReplyText("")
  }

  return (
    <div className="space-y-8">
      {/* Header da seção */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-violet-500/10 bg-gradient-to-br from-violet-500/15 to-purple-500/10 p-2">
            <ChatCircle className="size-5 text-violet-500" weight="fill" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Comentários</h3>
            <p className="text-muted-foreground/60 text-xs">
              {commentsCount} {commentsCount === 1 ? "comentário" : "comentários"}
            </p>
          </div>
        </div>

        {/* Ordenação */}
        <div className="border-border/60 bg-card/60 flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setSortBy("recent")}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              sortBy === "recent"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Recentes
          </button>
          <button
            onClick={() => setSortBy("popular")}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              sortBy === "popular"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Populares
          </button>
        </div>
      </div>

      {/* Campo de comentário */}
      {currentUserId ? (
        <div className="space-y-3">
          <div className="relative">
            <Textarea
              placeholder="Escreva um comentário..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="border-border/60 bg-card/40 focus-visible:border-brand-cyan/30 focus-visible:ring-brand-cyan/30 min-h-[90px] resize-none pr-24 text-sm"
              maxLength={2000}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <span className="text-muted-foreground/40 text-[10px]">
                {commentText.length}/2000
              </span>
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || addComment.isPending}
                className="btn-gradient-auth h-7 cursor-pointer rounded-lg px-3 text-xs font-semibold shadow-[0_6px_20px_-8px_rgba(20,247,254,0.5)]"
              >
                {addComment.isPending ? (
                  <CircleNotch className="size-3 animate-spin" />
                ) : (
                  <>
                    <PaperPlaneTilt className="mr-1 size-3" weight="fill" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl">
          <div className="flex flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="rounded-xl bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] p-2">
                <SignIn className="text-brand-cyan size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Participe da conversa</p>
                <p className="text-muted-foreground/60 text-xs">
                  Faça login para comentar e curtir
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border/60 cursor-pointer rounded-lg text-xs"
                >
                  Entrar
                </Button>
              </Link>
              <Link href={`/sign-up?ref=blog-${slug}`}>
                <Button
                  size="sm"
                  className="btn-gradient-auth cursor-pointer rounded-lg text-xs font-semibold"
                >
                  <Lightning className="mr-1 size-3" weight="fill" />
                  Cadastre-se
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Lista de comentários */}
      {isLoadingComments ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Bone delay={i * 120} className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Bone delay={i * 120 + 60} className="h-4 w-24" />
                  <Bone delay={i * 120 + 120} className="h-3 w-16" />
                </div>
                <Bone delay={i * 120 + 180} className="h-4 w-full" />
                <Bone delay={i * 120 + 240} className="h-4 w-3/4" />
                <div className="flex gap-3 pt-1">
                  <Bone delay={i * 120 + 300} className="h-3 w-8" />
                  <Bone delay={i * 120 + 360} className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                postId={postId}
                currentUserId={currentUserId}
                onReply={handleReply}
              />

              {/* Formulário de resposta */}
              {replyingTo === comment.id && currentUserId && (
                <div className="animate-fade-in-down mt-3 ml-10 space-y-2 sm:ml-14">
                  <div className="text-brand-cyan flex items-center gap-2 text-xs font-medium">
                    <ArrowElbowDownRight className="size-3" />
                    Respondendo a {comment.author.name || "Anônimo"}
                  </div>
                  <div className="relative">
                    <Textarea
                      placeholder="Escreva sua resposta..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="border-border/60 bg-card/40 focus-visible:ring-brand-cyan/30 min-h-[70px] resize-none text-xs"
                      maxLength={2000}
                      autoFocus
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyText("")
                        }}
                        className="text-muted-foreground h-7 cursor-pointer px-3 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitReply}
                        disabled={!replyText.trim() || addReply.isPending}
                        className="btn-gradient-auth h-7 cursor-pointer rounded-lg px-3 text-xs font-semibold"
                      >
                        {addReply.isPending ? (
                          <CircleNotch className="size-3 animate-spin" />
                        ) : (
                          <>
                            <PaperPlaneTilt
                              className="mr-1 size-3"
                              weight="fill"
                            />
                            Responder
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 p-4">
            <ChatCircle className="size-8 text-violet-500/30" />
          </div>
          <p className="text-muted-foreground mb-1 text-sm font-medium">
            Nenhum comentário ainda
          </p>
          <p className="text-muted-foreground/50 text-xs">
            Seja o primeiro a comentar neste artigo!
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// BOTÃO DE CURTIR
// ============================================================================
function LikeButton({
  postId,
  initialCount,
}: {
  postId: string
  initialCount: number
}) {
  const [optimisticLiked, setOptimisticLiked] = React.useState<boolean | null>(
    null,
  )
  const [optimisticCount, setOptimisticCount] = React.useState(initialCount)

  const { data: likeData } = api.blog.checkPostLike.useQuery({ postId })
  const isLiked = optimisticLiked ?? likeData?.liked ?? false
  const isLoggedIn = !!likeData?.userId

  const toggleLike = api.blog.togglePostLike.useMutation({
    onMutate: () => {
      const newLiked = !isLiked
      setOptimisticLiked(newLiked)
      setOptimisticCount((prev) => prev + (newLiked ? 1 : -1))
    },
    onError: () => {
      setOptimisticLiked(null)
      setOptimisticCount(initialCount)
      toast.error("Erro ao curtir")
    },
    onSuccess: (data) => {
      setOptimisticLiked(data.liked)
    },
  })

  const handleLike = () => {
    if (!isLoggedIn) {
      toast.error("Faça login para curtir este artigo", {
        action: {
          label: "Entrar",
          onClick: () => (window.location.href = "/sign-in"),
        },
      })
      return
    }
    toggleLike.mutate({ postId })
  }

  return (
    <button
      onClick={handleLike}
      disabled={toggleLike.isPending}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300",
        isLiked
          ? "border border-pink-500/25 bg-pink-500/15 text-pink-500 shadow-lg shadow-pink-500/10"
          : "border-border/60 bg-card/60 text-muted-foreground border hover:border-pink-500/30 hover:bg-pink-500/5 hover:text-pink-500",
      )}
    >
      <Heart
        weight={isLiked ? "fill" : "regular"}
        className={cn(
          "size-4 transition-all duration-300",
          isLiked && "scale-110",
          toggleLike.isPending && "animate-pulse",
        )}
      />
      <span>{formatNumber(optimisticCount)}</span>
    </button>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function BlogPost({ slug }: { slug: string }) {
  const [copied, setCopied] = React.useState(false)
  const { user, isLoaded: isUserLoaded } = useUser()

  const {
    data: post,
    isLoading,
    error,
  } = api.blog.getPublicPostBySlug.useQuery({ slug })

  const handleShare = () => {
    if (!post) return
    const url = window.location.href
    const shareText = `📖 ${post.title}\n\n${post.excerpt || "Confira este artigo incrível no Blog da Clipfy!"}\n\n🔗 Leia agora: ${url}\n\n💡 Descubra mais conteúdos exclusivos para clipadores na Central do Clipador!`
    void navigator.clipboard.writeText(shareText)
    setCopied(true)
    toast.success("Texto copiado para compartilhar!")
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return <BlogPostSkeleton />
  }

  if (error || !post) {
    return (
      <DarkScope className="contents">
        <div className="bg-background text-foreground min-h-screen">
          {/* Navbar */}
          <nav className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                <Link href="/blog" className="group flex items-center gap-3">
                  <Logo width={120} height={30} shadow={false} />
                  <div className="bg-border/80 h-6 w-px" />
                  <span className="text-muted-foreground group-hover:text-foreground text-sm font-semibold transition-colors">
                    Blog
                  </span>
                </Link>
                <div className="flex items-center gap-2">
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
                            <User
                              className="size-3.5 text-[#04222A]"
                              weight="fill"
                            />
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
                      <Link href={`/sign-up?ref=blog-${slug}`}>
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

          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="glass-card relative overflow-hidden rounded-3xl">
              <span
                aria-hidden
                className="absolute top-0 right-0 -mt-20 -mr-20 size-40 rounded-full bg-red-500/5"
              />
              <div className="relative flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 rounded-2xl bg-red-500/15 p-4">
                  <BookOpen className="size-8 text-red-500/60" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Post não encontrado</h1>
                <p className="text-muted-foreground mb-6">
                  O artigo que você procura não existe ou não está publicado.
                </p>
                <Link href="/blog">
                  <Button className="btn-gradient-auth cursor-pointer rounded-xl font-semibold">
                    <ArrowLeft className="mr-2 size-4" />
                    Voltar ao Blog
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </DarkScope>
    )
  }

  const catColor = post.category?.color || "#14f7fe"

  return (
    <DarkScope className="contents">
      <main className="bg-background text-foreground min-h-screen">
        {/* ============================================================ */}
        {/* NAVBAR */}
        {/* ============================================================ */}
        <nav className="border-border/60 bg-background/70 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur-2xl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/blog"
                  className="hover:bg-muted/50 cursor-pointer rounded-lg p-1.5 transition-colors"
                >
                  <ArrowLeft className="size-4" />
                </Link>
                <Link href="/blog" className="group flex items-center gap-3">
                  <Logo width={120} height={30} shadow={false} />
                  <div className="bg-border/80 hidden h-6 w-px sm:block" />
                  <span className="text-muted-foreground group-hover:text-foreground hidden text-sm font-semibold transition-colors sm:block">
                    Blog
                  </span>
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="text-muted-foreground border-border/60 cursor-pointer rounded-lg text-xs"
                >
                  {copied ? (
                    <Check className="text-brand-green mr-1.5 size-3.5" />
                  ) : (
                    <ShareNetwork className="mr-1.5 size-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {copied ? "Copiado!" : "Compartilhar"}
                  </span>
                </Button>
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
                          <User
                            className="size-3.5 text-[#04222A]"
                            weight="fill"
                          />
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
                    <Link href={`/sign-up?ref=blog-${slug}`}>
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
        {/* IMAGEM DE CAPA */}
        {/* ============================================================ */}
        {post.coverImageUrl && (
          <div className="relative h-64 w-full overflow-hidden md:h-[28rem]">
            <Image
              src={post.coverImageUrl}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030d18] via-[#030d18]/30 to-transparent" />
          </div>
        )}

        {/* ============================================================ */}
        {/* ARTIGO */}
        {/* ============================================================ */}
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <header
            className={cn(
              "space-y-5",
              post.coverImageUrl ? "relative z-10 -mt-20" : "pt-10",
            )}
          >
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {post.isFeatured && (
                <Badge className="border-0 bg-amber-500/90 text-xs text-white shadow-lg">
                  <Star className="mr-1 size-3" weight="fill" />
                  Destaque
                </Badge>
              )}
              {post.isPinned && (
                <Badge className="border-0 bg-blue-500/90 text-xs text-white shadow-lg">
                  <PushPin className="mr-1 size-3" weight="fill" />
                  Fixado
                </Badge>
              )}
              {post.category && (
                <Badge
                  variant="outline"
                  className="border text-xs"
                  style={{
                    backgroundColor: `${catColor}15`,
                    color: catColor,
                    borderColor: `${catColor}40`,
                  }}
                >
                  <Tag className="mr-1 size-3" />
                  {post.category.title}
                </Badge>
              )}
              {post.readTimeMinutes && (
                <Badge
                  variant="outline"
                  className="text-muted-foreground border-border text-xs"
                >
                  <Clock className="mr-1 size-3" />
                  {post.readTimeMinutes} min de leitura
                </Badge>
              )}
            </div>

            {/* Título */}
            <h1 className="text-gradient text-3xl leading-tight font-bold tracking-tight sm:text-4xl md:text-5xl">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-muted-foreground text-lg leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {/* Autor + Meta */}
            <div className="border-border/80 flex flex-col gap-4 border-y py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {post.author?.imageUrl ? (
                  <Image
                    src={post.author.imageUrl}
                    alt={post.author.name || ""}
                    width={40}
                    height={40}
                    className="ring-border/80 rounded-full ring-2"
                  />
                ) : (
                  <div className="bg-gradient-custom ring-border/80 flex size-10 items-center justify-center rounded-full ring-2">
                    <User className="size-5 text-[#04222A]" weight="fill" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{post.author?.name || "Clipfy"}</p>
                  {post.publishedAt && (
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <CalendarBlank className="size-3.5" />
                      {format(
                        new Date(post.publishedAt),
                        "d 'de' MMMM 'de' yyyy",
                        { locale: ptBR },
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Métricas */}
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Eye className="size-4 text-sky-400" />
                  {formatNumber(post.viewsCount)}
                </span>
                <LikeButton postId={post.id} initialCount={post.likesCount} />
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <ChatCircle className="size-4 text-violet-400" />
                  {formatNumber(post.commentsCount)}
                </span>
              </div>
            </div>
          </header>

          {/* ============================================================ */}
          {/* CONTEÚDO MARKDOWN */}
          {/* ============================================================ */}
          <div
            className="prose prose-invert prose-lg prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground prose-h1:text-3xl prose-h1:mt-12 prose-h1:mb-6 prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:leading-relaxed prose-p:text-muted-foreground prose-a:text-brand-cyan prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-strong:font-semibold prose-em:text-muted-foreground prose-code:text-brand-cyan prose-code:bg-brand-cyan/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-card prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:text-sm prose-blockquote:border-l-brand-cyan prose-blockquote:bg-brand-cyan/5 prose-blockquote:rounded-r-xl prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:not-italic prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:text-muted-foreground prose-li:marker:text-brand-cyan prose-img:rounded-xl prose-img:shadow-lg prose-hr:border-border prose-table:text-sm prose-th:text-foreground prose-th:font-semibold prose-th:border-border prose-th:px-4 prose-th:py-2 prose-td:border-border prose-td:text-muted-foreground prose-td:px-4 prose-td:py-2 max-w-none py-10"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>

          {/* ============================================================ */}
          {/* BARRA DE ENGAJAMENTO */}
          {/* ============================================================ */}
          <div className="border-border/80 border-y py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LikeButton postId={post.id} initialCount={post.likesCount} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="text-muted-foreground border-border/60 h-9 cursor-pointer rounded-xl text-xs"
                >
                  {copied ? (
                    <Check className="text-brand-green mr-1.5 size-3.5" />
                  ) : (
                    <Copy className="mr-1.5 size-3.5" />
                  )}
                  {copied ? "Copiado!" : "Copiar Link"}
                </Button>
              </div>

              <div className="text-muted-foreground/60 flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Eye className="size-4 text-sky-400" />
                  {formatNumber(post.viewsCount)}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShareNetwork className="text-brand-cyan size-4" />
                  {formatNumber(post.sharesCount)}
                </span>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* TAGS */}
          {/* ============================================================ */}
          {post.tags && post.tags.length > 0 && (
            <div className="border-border/80 border-b py-8">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Tag className="text-brand-cyan size-4" />
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag: string) => (
                  <Link key={tag} href={`/blog?tag=${tag}`}>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground hover:text-foreground border-border/60 hover:border-brand-cyan/40 hover:bg-brand-cyan/10 cursor-pointer text-xs transition-all"
                    >
                      #{tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* POSTS RELACIONADOS */}
          {/* ============================================================ */}
          <RelatedPosts
            postId={post.id}
            categoryId={post.category?.id}
            tags={post.tags || []}
          />

          {/* ============================================================ */}
          {/* COMENTÁRIOS */}
          {/* ============================================================ */}
          <div className="py-10">
            <CommentsSection
              postId={post.id}
              commentsCount={post.commentsCount}
              slug={slug}
            />
          </div>

          {/* ============================================================ */}
          {/* CTA */}
          {/* ============================================================ */}
          <div className="pb-10">
            <div className="glass-card relative overflow-hidden rounded-3xl">
              <span
                aria-hidden
                className="absolute top-0 right-0 -mt-20 -mr-20 size-40 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_5%,transparent)]"
              />
              <div className="relative flex flex-col items-center justify-between gap-6 px-6 py-8 sm:flex-row">
                <div className="text-center sm:text-left">
                  <h3 className="mb-1 text-lg font-bold">
                    Gostou deste artigo?
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Compartilhe com outros clipadores e explore mais conteúdos.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="border-border cursor-pointer rounded-xl"
                  >
                    {copied ? (
                      <Check className="text-brand-green mr-2 size-4" />
                    ) : (
                      <Copy className="mr-2 size-4" />
                    )}
                    {copied ? "Copiado!" : "Copiar Link"}
                  </Button>
                  <Link href="/blog">
                    <Button className="btn-gradient-auth cursor-pointer rounded-xl font-semibold">
                      Ver Mais Posts
                      <CaretRight className="ml-1 size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </article>

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
              <div className="order-2 flex items-center gap-4 sm:order-3">
                <Link
                  href={`/sign-up?ref=blog-${slug}`}
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
      </main>
    </DarkScope>
  )
}

// ============================================================================
// POSTS RELACIONADOS
// ============================================================================
function RelatedPosts({
  postId,
  categoryId,
  tags,
}: {
  postId: string
  categoryId?: string
  tags: string[]
}) {
  const { data: posts, isLoading } = api.blog.getRelatedPosts.useQuery({
    postId,
    categoryId,
    tags,
    limit: 4,
  })

  if (isLoading) {
    return (
      <div className="border-border/80 border-t py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-gradient-custom rounded-xl p-2 shadow-[0_8px_24px_-10px_rgba(20,247,254,0.5)]">
            <Sparkle className="size-5 text-[#04222A]" weight="fill" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Bone className="h-6 w-48" />
            <Bone delay={80} className="h-3.5 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card flex flex-col overflow-hidden rounded-3xl"
            >
              <Bone delay={i * 120} className="h-40 w-full rounded-none sm:h-44" />
              <div className="space-y-3 p-4">
                <Bone delay={i * 120 + 60} className="h-4 w-20" />
                <Bone delay={i * 120 + 120} className="h-5 w-full" />
                <Bone delay={i * 120 + 180} className="h-4 w-3/4" />
                <div className="flex justify-between pt-2">
                  <Bone delay={i * 120 + 240} className="h-3.5 w-24" />
                  <Bone delay={i * 120 + 300} className="h-3.5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!posts || posts.length === 0) return null

  return (
    <div className="border-border/80 border-t py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-gradient-custom rounded-xl p-2.5 shadow-[0_8px_24px_-10px_rgba(20,247,254,0.5)]">
          <Sparkle className="size-5 text-[#04222A]" weight="fill" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">
            Leia também
          </h2>
          <p className="text-muted-foreground/70 text-xs sm:text-sm">
            Artigos que podem te interessar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {posts.map((relatedPost: RelatedPostItem, index: number) => {
          const catColor = relatedPost.category?.color || "#14f7fe"
          return (
            <Link
              key={relatedPost.id}
              href={`/blog/${relatedPost.slug}`}
              className="group block"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div
                className="glass-card glass-card-hover relative flex h-full flex-col overflow-hidden rounded-3xl"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${catColor}06, transparent 40%)`,
                }}
              >
                <span
                  aria-hidden
                  className="absolute top-0 right-0 -mt-12 -mr-12 size-24 rounded-full opacity-0 transition-all duration-700 group-hover:scale-[2.5] group-hover:opacity-100"
                  style={{ backgroundColor: `${catColor}08` }}
                />

                <div className="relative h-40 overflow-hidden sm:h-44">
                  {relatedPost.coverImageUrl ? (
                    <>
                      <Image
                        src={relatedPost.coverImageUrl}
                        alt={relatedPost.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <div className="from-card absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-80" />
                    </>
                  ) : (
                    <div className="from-muted/20 to-muted/5 flex h-full items-center justify-center bg-gradient-to-br">
                      <Newspaper className="text-muted-foreground/15 size-8" />
                    </div>
                  )}

                  {relatedPost.readTimeMinutes && (
                    <div className="absolute right-2.5 bottom-2.5">
                      <Badge className="border-0 bg-black/50 text-[10px] font-normal text-white/80 backdrop-blur-md">
                        <Clock className="mr-1 size-2.5" />
                        {relatedPost.readTimeMinutes} min
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="relative flex flex-1 flex-col space-y-2.5 p-4 sm:p-5">
                  {relatedPost.category && (
                    <Badge
                      variant="outline"
                      className="w-fit border text-[10px] font-medium"
                      style={{
                        backgroundColor: `${catColor}10`,
                        color: catColor,
                        borderColor: `${catColor}30`,
                      }}
                    >
                      <Tag className="mr-1 size-2.5" />
                      {relatedPost.category.title}
                    </Badge>
                  )}

                  <h3 className="group-hover:text-gradient line-clamp-2 text-sm leading-snug font-bold transition-all duration-500 sm:text-[15px]">
                    {relatedPost.title}
                  </h3>

                  {relatedPost.excerpt && (
                    <p className="text-muted-foreground/70 line-clamp-2 flex-1 text-xs leading-relaxed sm:text-sm">
                      {relatedPost.excerpt}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2.5">
                    <div className="flex items-center gap-2">
                      {relatedPost.author?.imageUrl ? (
                        <Image
                          src={relatedPost.author.imageUrl}
                          alt={relatedPost.author.name || ""}
                          width={20}
                          height={20}
                          className="ring-border/60 rounded-full ring-1"
                        />
                      ) : (
                        <div className="bg-gradient-custom ring-border/60 flex size-5 items-center justify-center rounded-full ring-1">
                          <User
                            className="size-2.5 text-[#04222A]"
                            weight="fill"
                          />
                        </div>
                      )}
                      <span className="text-muted-foreground/70 text-[11px] font-medium">
                        {relatedPost.author?.name || "Clipfy"}
                      </span>
                    </div>
                    {relatedPost.publishedAt && (
                      <span className="text-muted-foreground/50 text-[10px]">
                        {format(new Date(relatedPost.publishedAt), "d MMM yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    )}
                  </div>

                  <div className="border-border/60 text-muted-foreground/60 flex items-center gap-3 border-t pt-2.5">
                    <span className="flex items-center gap-1 text-[10px] sm:text-[11px]">
                      <Eye className="size-3 text-sky-400" />
                      {formatNumber(relatedPost.viewsCount)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] sm:text-[11px]">
                      <Heart className="size-3 text-pink-400" />
                      {formatNumber(relatedPost.likesCount)}
                    </span>
                    <span className="text-brand-cyan ml-auto flex translate-x-1 items-center gap-1 text-[10px] font-semibold opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:text-[11px]">
                      Ler <CaretRight className="size-3" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
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
