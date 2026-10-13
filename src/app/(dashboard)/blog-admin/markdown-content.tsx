"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Markdown dos previews de IA do blog-admin. Fica num módulo próprio para
 * react-markdown e remark-gfm carregarem só quando um preview abre.
 */
export function MarkdownContent({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
}
