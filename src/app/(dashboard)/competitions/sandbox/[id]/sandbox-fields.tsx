"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseBRLNumber } from "@/lib/currency"
import { cn } from "@/lib/utils"

/* ============================================================
   Campos
   ============================================================ */

/** Aceita "1.234.567", "1234567", "12,5" e "12.5" (até 2 casas). */
export function parseNumberInput(raw: string): number | null {
  const trimmed = raw.replace(/%/g, "").trim()
  if (!trimmed) return 0
  return parseBRLNumber(trimmed)
}

function formatNumberInput(value: number, decimals: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

/**
 * Número com separador pt-BR. Enquanto o campo está em foco mostra o texto
 * digitado; fora dele, o valor atual formatado (também o que mudar por fora).
 */
export function NumberInput({
  value,
  onChange,
  decimals = 0,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number
  onChange: (value: number) => void
  decimals?: number
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const invalid = draft !== null && parseNumberInput(draft) === null

  return (
    <Input
      {...props}
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      value={draft ?? formatNumberInput(value, decimals)}
      aria-invalid={invalid || undefined}
      onFocus={(event) => {
        setDraft(formatNumberInput(value, decimals))
        event.currentTarget.select()
      }}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const parsed = parseNumberInput(text)
        if (parsed === null || parsed < 0) return
        onChange(
          decimals > 0
            ? Math.round(parsed * 10 ** decimals) / 10 ** decimals
            : Math.round(parsed),
        )
      }}
      onBlur={() => setDraft(null)}
      className={cn("h-9 rounded-lg text-right tabular-nums", className)}
    />
  )
}

/** Lista separada por vírgula (hashtags, menções). */
export function ListInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [draft, setDraft] = React.useState<string | null>(null)

  return (
    <Input
      {...props}
      value={draft ?? value.join(", ")}
      onFocus={() => setDraft(value.join(", "))}
      onChange={(event) => {
        setDraft(event.target.value)
        onChange(
          event.target.value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        )
      }}
      onBlur={() => setDraft(null)}
      className={cn("h-10 rounded-xl", className)}
    />
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  )
}

export function SectionCard({
  icon,
  title,
  subtitle,
  actions,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
            {icon}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-bold sm:text-base">{title}</p>
            {subtitle && (
              <p className="text-muted-foreground text-xs">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/* ============================================================
   Tabela editável (linhas com posição, reordenar e remover)
   ============================================================ */

export interface EditableColumn<Row> {
  key: string
  header: string
  /** Largura mínima da coluna (classe Tailwind, ex.: "min-w-32"). */
  className?: string
  render: (
    row: Row,
    update: (patch: Partial<Row>) => void,
    index: number,
  ) => React.ReactNode
}

type RowActions<Row> = {
  update: (id: string, patch: Partial<Row>) => void
  move: (id: string, offset: -1 | 1) => void
  remove: (id: string) => void
}

function EditableRowInner<Row extends { id: string }>({
  row,
  index,
  isLast,
  columns,
  showPosition,
  actions,
}: {
  row: Row
  index: number
  isLast: boolean
  columns: EditableColumn<Row>[]
  showPosition: boolean
  actions: RowActions<Row>
}) {
  return (
    <tr className="border-border/40 border-t">
      {showPosition && (
        <td className="px-2 py-1.5 font-bold tabular-nums">{index + 1}º</td>
      )}
      {columns.map((column) => (
        <td key={column.key} className={cn("px-1.5 py-1.5", column.className)}>
          {column.render(row, (patch) => actions.update(row.id, patch), index)}
        </td>
      ))}
      <td className="px-2 py-1.5">
        <div className="flex justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 cursor-pointer rounded-lg p-0"
            disabled={index === 0}
            aria-label="Subir"
            onClick={() => actions.move(row.id, -1)}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 cursor-pointer rounded-lg p-0"
            disabled={isLast}
            aria-label="Descer"
            onClick={() => actions.move(row.id, 1)}
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 cursor-pointer rounded-lg p-0 text-red-500 hover:bg-red-500/10 hover:text-red-500"
            aria-label="Remover"
            onClick={() => actions.remove(row.id)}
          >
            <Trash className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// Só a linha editada re-renderiza: as demais recebem a mesma `row`, as
// mesmas colunas (estáveis no chamador) e as mesmas ações.
const EditableRow = React.memo(EditableRowInner) as typeof EditableRowInner

/**
 * `columns` deve ser estável (constante de módulo ou `useMemo`), senão toda
 * linha re-renderiza a cada tecla.
 */
export function EditableTable<Row extends { id: string }>({
  rows,
  columns,
  onChange,
  newRow,
  maxRows,
  addLabel = "Adicionar linha",
  showPosition = true,
  emptyLabel = "Nenhuma linha",
}: {
  rows: Row[]
  columns: EditableColumn<Row>[]
  onChange: (rows: Row[]) => void
  newRow?: () => Row
  maxRows: number
  addLabel?: string
  showPosition?: boolean
  emptyLabel?: string
}) {
  // As ações leem as linhas e o onChange mais recentes, para continuarem as
  // mesmas entre renders (é o que deixa o memo das linhas funcionar).
  const latest = React.useRef({ rows, onChange })
  React.useLayoutEffect(() => {
    latest.current = { rows, onChange }
  })
  const actions = React.useMemo<RowActions<Row>>(
    () => ({
      update: (id, patch) => {
        const { rows, onChange } = latest.current
        onChange(
          rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        )
      },
      move: (id, offset) => {
        const { rows, onChange } = latest.current
        const from = rows.findIndex((row) => row.id === id)
        const to = from + offset
        if (from < 0 || to < 0 || to >= rows.length) return
        const next = [...rows]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item!)
        onChange(next)
      },
      remove: (id) => {
        const { rows, onChange } = latest.current
        onChange(rows.filter((row) => row.id !== id))
      },
    }),
    [],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border/60 max-h-[560px] overflow-auto rounded-2xl border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/80 sticky top-0 z-10 backdrop-blur">
            <tr>
              {showPosition && (
                <th className="text-muted-foreground w-10 px-2 py-2 text-left font-semibold">
                  #
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "text-muted-foreground px-1.5 py-2 text-left font-semibold whitespace-nowrap",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
              <th className="w-24 px-2 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (showPosition ? 2 : 1)}
                  className="text-muted-foreground px-3 py-6 text-center"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <EditableRow
                key={row.id}
                row={row}
                index={index}
                isLast={index === rows.length - 1}
                columns={columns}
                showPosition={showPosition}
                actions={actions}
              />
            ))}
          </tbody>
        </table>
      </div>
      {newRow && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-fit cursor-pointer rounded-xl"
          disabled={rows.length >= maxRows}
          onClick={() => onChange([...rows, newRow()])}
        >
          <Plus className="size-3.5" weight="bold" />
          {addLabel}
        </Button>
      )}
    </div>
  )
}

/* ============================================================
   Colunas prontas
   ============================================================ */

type KeysOfType<Row, Value> = {
  [K in keyof Row]: Row[K] extends Value ? K : never
}[keyof Row] &
  string

export function numberColumn<Row>(
  key: KeysOfType<Row, number>,
  header: string,
  options: { decimals?: number; className?: string } = {},
): EditableColumn<Row> {
  return {
    key,
    header,
    className: options.className ?? "min-w-28",
    render: (row, update) => (
      <NumberInput
        aria-label={header}
        value={row[key] as number}
        decimals={options.decimals}
        onChange={(value) => update({ [key]: value } as Partial<Row>)}
      />
    ),
  }
}

export function textColumn<Row>(
  key: KeysOfType<Row, string>,
  header: string,
  options: {
    className?: string
    placeholder?: string
    maxLength?: number
  } = {},
): EditableColumn<Row> {
  return {
    key,
    header,
    className: options.className ?? "min-w-36",
    render: (row, update) => (
      <Input
        aria-label={header}
        value={row[key] as string}
        placeholder={options.placeholder}
        maxLength={options.maxLength ?? 200}
        onChange={(event) =>
          update({ [key]: event.target.value } as Partial<Row>)
        }
        className="h-9 rounded-lg"
      />
    ),
  }
}
