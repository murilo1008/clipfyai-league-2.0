import { use } from "react"
import { type Metadata } from "next"

import { db } from "@/server/db"

import BlogPost from "./blog-post"

// ============================================================================
// METADATA DINÂMICA (SEO)
// ============================================================================
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  const post = await db.blogPost.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      coverImageUrl: true,
      metaTitle: true,
      metaDescription: true,
      tags: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { name: true } },
      category: { select: { title: true } },
    },
  })

  if (!post) {
    return {
      title: "Post não encontrado | Central do Clipador",
      description: "O artigo que você está procurando não foi encontrado.",
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://league.clipfyai.com"
  const postUrl = `${baseUrl}/blog/${slug}`
  const seoTitle = post.metaTitle || post.title
  const seoDescription =
    post.metaDescription ||
    post.excerpt ||
    `Leia "${post.title}" na Central do Clipador — dicas, estratégias e tendências para clipadores.`

  return {
    title: `${seoTitle} | Central do Clipador`,
    description: seoDescription,
    keywords: post.tags?.length ? post.tags : undefined,
    authors: post.author?.name
      ? [{ name: post.author.name }]
      : [{ name: "Clipfy" }],
    creator: post.author?.name || "Clipfy",
    publisher: "Clipfy",
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: postUrl,
      siteName: "Central do Clipador | Clipfy",
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      authors: post.author?.name ? [post.author.name] : ["Clipfy"],
      section: post.category?.title || "Blog",
      tags: post.tags || [],
      locale: "pt_BR",
      images: post.coverImageUrl
        ? [
            {
              url: post.coverImageUrl,
              width: 1792,
              height: 1024,
              alt: post.title,
              type: "image/png",
            },
          ]
        : [
            {
              url: `${baseUrl}/images/blog/blog-home.png`,
              width: 1200,
              height: 630,
              alt: "Central do Clipador",
            },
          ],
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description: seoDescription,
      images: post.coverImageUrl
        ? [post.coverImageUrl]
        : [`${baseUrl}/images/blog/blog-home.png`],
      creator: "@clipfy",
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  }
}

// ============================================================================
// DADOS ESTRUTURADOS JSON-LD
// ============================================================================
async function getJsonLd(slug: string) {
  const post = await db.blogPost.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      content: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      readTimeMinutes: true,
      tags: true,
      author: { select: { name: true, imageUrl: true } },
      category: { select: { title: true } },
    },
  })

  if (!post) return null

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://league.clipfyai.com"
  const postUrl = `${baseUrl}/blog/${slug}`
  const wordCount = post.content?.split(/\s+/).length || 0

  // Dados estruturados do artigo
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || "",
    image: post.coverImageUrl || `${baseUrl}/images/blog/blog-home.png`,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    wordCount,
    timeRequired: `PT${post.readTimeMinutes || 5}M`,
    author: {
      "@type": "Person",
      name: post.author?.name || "Clipfy",
      ...(post.author?.imageUrl ? { image: post.author.imageUrl } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "Clipfy",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/favicon.ico`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    url: postUrl,
    keywords: post.tags?.join(", ") || "",
    articleSection: post.category?.title || "Blog",
    inLanguage: "pt-BR",
  }

  // Breadcrumb
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${baseUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: postUrl,
      },
    ],
  }

  return { articleJsonLd, breadcrumbJsonLd }
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================
export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const jsonLdData = use(getJsonLd(slug))

  return (
    <>
      {/* JSON-LD Structured Data */}
      {jsonLdData && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLdData.articleJsonLd),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLdData.breadcrumbJsonLd),
            }}
          />
        </>
      )}
      <BlogPost slug={slug} />
    </>
  )
}
