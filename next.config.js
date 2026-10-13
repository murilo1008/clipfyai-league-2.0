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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default config;
