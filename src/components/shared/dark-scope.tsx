import { cn } from "@/lib/utils"

/**
 * Força o escopo dark nos filhos (troca os tokens CSS), independente do tema.
 * Use com className="contents" para não criar caixa de layout.
 */
export function DarkScope({
  className,
  style,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("dark", className)}
      style={{ colorScheme: "dark", ...style }}
      {...props}
    />
  )
}
