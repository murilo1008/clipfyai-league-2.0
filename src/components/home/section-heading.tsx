import Link from "next/link"
import { CaretRight } from "@phosphor-icons/react/dist/ssr"

interface SectionHeadingProps {
  icon: React.ReactNode
  title: string
  description?: string
  href?: string
  hrefLabel?: string
}

export function SectionHeading({
  icon,
  title,
  description,
  href,
  hrefLabel = "Ver tudo",
}: SectionHeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
      <div className="flex items-center gap-2.5">
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          {icon}
        </span>
        <div className="leading-tight">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground text-xs sm:text-[13px]">
              {description}
            </p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="text-brand-cyan not-dark:text-primary inline-flex items-center gap-0.5 text-xs font-semibold transition-opacity hover:opacity-80 sm:text-sm"
        >
          {hrefLabel}
          <CaretRight className="size-3.5" weight="bold" />
        </Link>
      )}
    </div>
  )
}
