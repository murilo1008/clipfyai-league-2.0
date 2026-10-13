/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  eslint: {
    // Desabilitar ESLint durante builds
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Reescreve imports de barrel para o módulo exato (tree-shaking real).
    // lucide-react, date-fns e recharts já estão na lista padrão do Next.
    optimizePackageImports: [
      "radix-ui",
      "@phosphor-icons/react",
      "framer-motion",
    ],
  },
  images: {
    // Só passam pelo otimizador (/_next/image) os hosts de onde o app serve
    // imagens próprias. O `'**'` de antes transformava o endpoint num proxy
    // aberto. Thumbnails de TikTok/Instagram/YouTube (URLs assinadas que
    // expiram) usam <ClipThumbnail>, que é `unoptimized` e não depende desta
    // lista. Host novo aqui = imagem de next/image sem `unoptimized`.
    remotePatterns: [
      // UploadThing: capas de competição/módulo/categoria/post do blog,
      // imagens de clã e comprovantes PIX (`url` antigo e `ufsUrl` atual)
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "ufs.sh" },
      { protocol: "https", hostname: "*.ufs.sh" },
      // Avatar do Clerk salvo em User.imageUrl (autores e comentários do blog)
      { protocol: "https", hostname: "img.clerk.com" },
      // Capa padrão de competição (routers/competition.ts) e capas do seed do blog
      { protocol: "https", hostname: "images.unsplash.com" },
      // Thumbnail de aula derivada do link do YouTube (academia)
      { protocol: "https", hostname: "img.youtube.com" },
      // Depoimentos da página /academia-clipadora
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
};

export default config;
