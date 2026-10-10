"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  CaretLeft,
  CaretRight,
  Clock,
  Receipt,
  SealCheck,
  Wallet,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyPanel, ErrorPanel, PageHeader, formatDate } from "./shared";
import { tierLabels } from "./labels";

const movements = {
  GRANT: { label: "Créditos recebidos", icon: ArrowDown },
  RESERVE: { label: "Créditos reservados", icon: Clock },
  CONSUME: { label: "Créditos utilizados", icon: ArrowUp },
  RELEASE: { label: "Reserva liberada", icon: ArrowClockwise },
  REFUND: { label: "Créditos reembolsados", icon: ArrowClockwise },
  EXPIRE: { label: "Créditos expirados", icon: Clock },
};
const minutes = new Intl.NumberFormat("pt-BR");

export function CreditsView() {
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const credits = api.leagueClips.credits.useQuery();
  const ledger = api.leagueClips.ledger.useQuery({ cursor });
  const hasPagination = !!history.length || !!ledger.data?.nextCursor;

  return (
    <main className="mx-auto max-w-6xl p-4 pb-16 md:p-8">
      <PageHeader
        title="Seus créditos"
        description="Acompanhe os minutos disponíveis e o uso nos seus projetos."
      />

      <section aria-label="Resumo de créditos" className="mb-8">
        {credits.isLoading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            role="status"
            aria-label="Carregando saldo de créditos"
          >
            <Skeleton className="h-52 rounded-2xl sm:col-span-2" />
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        ) : credits.isError ? (
          <ErrorPanel
            message="Não foi possível carregar seus créditos. Tente novamente."
            retry={() => void credits.refetch()}
          />
        ) : credits.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-primary/25 relative overflow-hidden rounded-2xl shadow-none sm:col-span-2">
              <div
                aria-hidden="true"
                className="from-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent"
              />
              <CardContent className="relative">
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-lg p-2">
                    <Wallet className="size-5" />
                  </span>
                  <h2 className="text-sm font-medium">Disponíveis para usar</h2>
                </div>
                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight tabular-nums">
                    {minutes.format(credits.data.balanceMinutes)}
                  </span>
                  <span className="text-muted-foreground text-lg">minutos</span>
                </p>
                <p className="text-muted-foreground mt-3 text-sm">
                  1 crédito = 1 minuto do vídeo enviado.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-none">
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="text-muted-foreground size-5" />
                  <h2 className="text-sm font-medium">Reservados</h2>
                </div>
                <p className="mt-6 text-3xl font-semibold tabular-nums">
                  {minutes.format(credits.data.reservedMinutes)}{" "}
                  <span className="text-muted-foreground text-base font-normal">
                    min
                  </span>
                </p>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Separados para projetos em processamento, até a conclusão.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-none">
              <CardContent>
                <div className="flex items-center gap-2">
                  <SealCheck className="text-muted-foreground size-5" />
                  <h2 className="text-sm font-medium">Seu plano</h2>
                </div>
                <p className="mt-6 text-2xl font-semibold">
                  {tierLabels[credits.data.tier]}
                </p>
                <Badge variant="outline" className="mt-3 font-normal">
                  {credits.data.watermark
                    ? "Clipes com marca d’água"
                    : "Clipes sem marca d’água"}
                </Badge>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="ledger-title">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="ledger-title" className="text-lg font-semibold">
              Histórico de créditos
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Recebimentos, reservas e uso dos seus minutos.
            </p>
          </div>
          {ledger.data?.items.length ? (
            <span className="text-muted-foreground text-xs">
              Página {history.length + 1}
            </span>
          ) : null}
        </div>

        {ledger.isLoading ? (
          <div
            role="status"
            aria-label="Carregando histórico de créditos"
            className="space-y-2"
          >
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : ledger.isError ? (
          <ErrorPanel
            message="Não foi possível carregar o histórico de créditos. Tente novamente."
            retry={() => void ledger.refetch()}
          />
        ) : !ledger.data?.items.length ? (
          <EmptyPanel
            title="Seu histórico começa aqui"
            detail="Quando você receber ou usar créditos, cada movimentação aparecerá nesta lista."
          />
        ) : (
          <div className="bg-card overflow-hidden rounded-2xl border">
            <div
              aria-hidden="true"
              className="bg-muted/40 text-muted-foreground hidden grid-cols-[minmax(0,1fr)_6rem_12rem] gap-5 border-b px-5 py-3 text-xs font-medium md:grid"
            >
              <span>Movimentação</span>
              <span className="text-right">Minutos</span>
              <span className="text-right">Após a movimentação</span>
            </div>
            <ul className="divide-y">
              {ledger.data.items.map((entry) => {
                const movement = movements[entry.type];
                const Icon = movement.icon;
                return (
                  <li
                    key={entry.id}
                    className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_6rem_12rem] md:items-center md:gap-5 md:px-5"
                  >
                    <div className="flex min-w-0 gap-3">
                      <span className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{movement.label}</p>
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <time dateTime={entry.createdAt}>
                            {formatDate(entry.createdAt)}
                          </time>
                          {entry.projectId && (
                            <Link
                              href={"/ai-clips/" + entry.projectId}
                              className="text-primary rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                              Ver projeto
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-medium tabular-nums md:text-right">
                      <span className="text-muted-foreground mr-2 text-xs font-normal md:sr-only">
                        Quantidade:
                      </span>
                      {minutes.format(entry.amount)} min
                    </p>
                    <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums md:block md:space-y-1 md:text-right">
                      <p>
                        Disponíveis: {minutes.format(entry.balanceAfter)} min
                      </p>
                      <p>
                        Reservados: {minutes.format(entry.reservedAfter)} min
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {hasPagination && (
          <nav
            aria-label="Páginas do histórico de créditos"
            className="mt-5 flex items-center justify-between gap-3"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={!history.length || ledger.isFetching}
              onClick={() => {
                setCursor(history.at(-1));
                setHistory(history.slice(0, -1));
              }}
            >
              <CaretLeft className="size-4" />
              Anterior
            </Button>
            <span className="text-muted-foreground text-xs" aria-live="polite">
              Página {history.length + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!ledger.data?.nextCursor || ledger.isFetching}
              onClick={() => {
                setHistory([...history, cursor]);
                setCursor(ledger.data?.nextCursor ?? undefined);
              }}
            >
              Próxima
              <CaretRight className="size-4" />
            </Button>
          </nav>
        )}
        {!!ledger.data?.items.length && (
          <p className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
            <Receipt className="size-4 shrink-0" />O saldo de cada linha
            corresponde ao momento daquela movimentação.
          </p>
        )}
      </section>
    </main>
  );
}
