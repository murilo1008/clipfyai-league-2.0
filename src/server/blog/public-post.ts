import type { Prisma } from "@prisma/client";

/**
 * Campos do post público: os que a página do artigo mostra, os metadados de
 * SEO e o JSON-LD. A rota /blog/[slug] lê o post uma vez com este select e o
 * `blog.getPublicPostBySlug` devolve o mesmo formato.
 */
export const publicPostSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  coverImageUrl: true,
  tags: true,
  status: true,
  isFeatured: true,
  isPinned: true,
  publishedAt: true,
  updatedAt: true,
  viewsCount: true,
  likesCount: true,
  commentsCount: true,
  sharesCount: true,
  readTimeMinutes: true,
  metaTitle: true,
  metaDescription: true,
  author: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
  category: {
    select: {
      id: true,
      title: true,
      slug: true,
      color: true,
    },
  },
} satisfies Prisma.BlogPostSelect;

export type PublicPostRecord = Prisma.BlogPostGetPayload<{
  select: typeof publicPostSelect;
}>;

/** Formato devolvido ao leitor (sem status nem datas internas). */
export function toPublicPost(post: PublicPostRecord, viewsCount: number) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImageUrl: post.coverImageUrl,
    tags: post.tags,
    isFeatured: post.isFeatured,
    isPinned: post.isPinned,
    publishedAt: post.publishedAt,
    viewsCount,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    sharesCount: post.sharesCount,
    readTimeMinutes: post.readTimeMinutes,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    author: post.author,
    category: post.category,
  };
}

export type PublicPost = ReturnType<typeof toPublicPost>;
