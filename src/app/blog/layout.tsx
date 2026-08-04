import { type Metadata } from "next"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://league.clipfyai.com"

export const metadata: Metadata = {
  title: {
    default: "Central do Clipador | Blog da Clipfy",
    template: "%s | Central do Clipador",
  },
  description:
    "Dicas, tutoriais, tendências e estratégias para clipadores dominarem as redes sociais e transformarem cortes em resultados. Blog oficial da Clipfy.",
  keywords: [
    "clipador",
    "clipfy",
    "cortes de vídeo",
    "marketing digital",
    "redes sociais",
    "TikTok",
    "YouTube Shorts",
    "Instagram Reels",
    "criador de conteúdo",
    "monetização",
    "competição de clips",
    "engajamento",
    "viralizar",
    "edição de vídeo",
    "empreendedorismo digital",
  ],
  authors: [{ name: "Clipfy", url: baseUrl }],
  creator: "Clipfy",
  publisher: "Clipfy",
  alternates: {
    canonical: `${baseUrl}/blog`,
  },
  openGraph: {
    title: "Central do Clipador | Blog da Clipfy",
    description:
      "Dicas, tutoriais, tendências e estratégias para clipadores dominarem as redes sociais e transformarem cortes em resultados.",
    url: `${baseUrl}/blog`,
    siteName: "Central do Clipador | Clipfy",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: `${baseUrl}/images/blog/blog-home.png`,
        width: 1200,
        height: 630,
        alt: "Central do Clipador — Blog da Clipfy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Central do Clipador | Blog da Clipfy",
    description:
      "Dicas, tutoriais, tendências e estratégias para clipadores dominarem as redes sociais.",
    images: [`${baseUrl}/images/blog/blog-home.png`],
    creator: "@clipfy",
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // JSON-LD do Blog (WebSite + Organization)
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Central do Clipador",
    description:
      "Blog oficial da Clipfy com dicas, tutoriais e estratégias para clipadores e criadores de conteúdo.",
    url: `${baseUrl}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Clipfy",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/favicon.ico`,
      },
    },
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Clipfy",
    url: baseUrl,
    logo: `${baseUrl}/favicon.ico`,
    description:
      "Plataforma brasileira de marketing de influência que conecta clipadores com empresas através de competições de engajamento nas redes sociais.",
    sameAs: [],
    foundingDate: "2024",
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {children}
    </>
  )
}
