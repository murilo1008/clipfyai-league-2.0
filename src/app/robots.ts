import { type MetadataRoute } from "next"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://league.clipfyai.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/*", "/landing-page", "/sign-up", "/sign-in"],
        disallow: [
          "/api/",
          "/blog-admin",
          "/blog-admin/*",
          "/settings",
          "/settings/*",
          "/competitions",
          "/competitions/*",
          "/my-competitions",
          "/my-competitions/*",
          "/clippers",
          "/clippers/*",
          "/financial",
          "/financial/*",
          "/organizations",
          "/organizations/*",
          "/onboarding",
          "/approve",
          "/banned",
          "/classes",
          "/classes/*",
          "/academy",
          "/academy/*",
          "/sales",
          "/sales/*",
          "/posts",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/blog", "/blog/*"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
