import { sandboxDataSchema, type SandboxData } from "@/lib/competition-sandbox"

/*
 * Rascunho local das edições não salvas. Cobre o que o aviso de saída não
 * pega (voltar/avançar do navegador, navegação por código): ao reabrir o
 * sandbox, as edições voltam se ninguém salvou outra versão no meio.
 */
export type Draft = { baseUpdatedAt: number; name: string; data: SandboxData }

const draftKey = (id: string) => `competition-sandbox-draft:${id}`

export function readDraft(id: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(id))
    if (!raw) return null
    const draft = JSON.parse(raw) as Partial<Draft>
    const data = sandboxDataSchema.safeParse(draft.data)
    if (
      typeof draft.baseUpdatedAt !== "number" ||
      typeof draft.name !== "string" ||
      !data.success
    ) {
      return null
    }
    return {
      baseUpdatedAt: draft.baseUpdatedAt,
      name: draft.name,
      data: data.data,
    }
  } catch {
    return null
  }
}

export function writeDraft(id: string, draft: Draft) {
  try {
    window.localStorage.setItem(draftKey(id), JSON.stringify(draft))
  } catch {
    // Sem espaço ou storage bloqueado: segue só com o aviso de saída
  }
}

export function clearDraft(id: string) {
  try {
    window.localStorage.removeItem(draftKey(id))
  } catch {
    // Storage bloqueado: nada a limpar
  }
}
