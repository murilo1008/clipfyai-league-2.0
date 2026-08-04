"use client"

import * as React from "react"
import Link from "next/link"
import {
  CheckCircle,
  Clock,
  CurrencyDollar,
  FileText,
  List,
  Scales,
  Shield,
  Target,
  UsersThree,
  Warning,
  X,
  type Icon,
} from "@phosphor-icons/react"

import { Logo } from "@/components/logo"
import { DarkScope } from "@/components/shared/dark-scope"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const sections: Array<{ id: string; title: string; icon: Icon }> = [
  { id: "intro", title: "Introdução", icon: FileText },
  { id: "definicoes", title: "1. Definições", icon: FileText },
  { id: "elegibilidade", title: "2. Elegibilidade", icon: UsersThree },
  { id: "escopo", title: "3. Escopo", icon: Target },
  { id: "inscricao", title: "4. Inscrição", icon: Clock },
  { id: "envio", title: "5. Envio de Posts", icon: Target },
  { id: "conteudo", title: "6. Conteúdo", icon: Shield },
  { id: "antifraude", title: "7. Antifraude", icon: Warning },
  { id: "avaliacao", title: "8. Avaliação", icon: CheckCircle },
  { id: "auditoria", title: "9. Auditoria", icon: Shield },
  { id: "empates", title: "10. Empates", icon: Scales },
  { id: "penalidades", title: "11. Penalidades", icon: Warning },
  { id: "premiacao", title: "12. Premiação", icon: CurrencyDollar },
  { id: "pagamento", title: "13. Pagamento", icon: CurrencyDollar },
  { id: "comunicacao", title: "14. Comunicação", icon: FileText },
  { id: "suporte", title: "15. Suporte", icon: UsersThree },
  { id: "privacidade", title: "16. Privacidade", icon: Shield },
  { id: "disposicoes", title: "17. Disposições", icon: Scales },
  { id: "anexos", title: "Anexos", icon: CheckCircle },
]

/** Chip numerado das seções, no gradiente da marca. */
function SectionNumber({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-[#04222A]">
      {children}
    </span>
  )
}

/** Título de seção do regulamento. */
function SectionTitle({
  number,
  children,
}: {
  number: string
  children: React.ReactNode
}) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
      <SectionNumber>{number}</SectionNumber>
      <span className="min-w-0">{children}</span>
    </h2>
  )
}

/** Cartão de definição (grade da Seção 1 e docs da Seção 13). */
function InfoCell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
      <p className="mb-1 font-semibold">{title}</p>
      <div className="text-muted-foreground text-sm">{children}</div>
    </div>
  )
}

export default function Rules() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 100
      const bodyRect = document.body.getBoundingClientRect().top
      const elementRect = element.getBoundingClientRect().top
      const elementPosition = elementRect - bodyRect
      const offsetPosition = elementPosition - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
      setMobileMenuOpen(false)
    }
  }

  const navigation = (
    <div className="space-y-1">
      {sections.map((section) => {
        const SectionIcon = section.icon
        return (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className="hover:bg-brand-cyan/10 flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors"
          >
            <SectionIcon
              className="text-brand-cyan size-4 shrink-0"
              weight="duotone"
            />
            <span className="truncate">{section.title}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <DarkScope className="text-foreground relative min-h-svh overflow-x-clip bg-[#030d18]">
      {/* ===== Ambiente fixo: grade + auroras da marca ===== */}
      <div
        aria-hidden
        className="bg-grid-pattern pointer-events-none fixed inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)]"
      />
      <span
        aria-hidden
        className="arena-aurora pointer-events-none fixed -top-32 -left-24 size-[26rem] rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] blur-3xl sm:size-[32rem]"
      />
      <span
        aria-hidden
        className="arena-aurora pointer-events-none fixed -right-28 -bottom-36 size-[26rem] rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-3xl sm:size-[34rem]"
        style={{ animationDelay: "-7s" }}
      />

      {/* ===== Botão do menu mobile ===== */}
      <div className="fixed top-4 right-4 z-50 lg:hidden">
        <Button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          size="icon"
          aria-label={mobileMenuOpen ? "Fechar navegação" : "Abrir navegação"}
          className="btn-gradient-auth size-11 cursor-pointer rounded-full text-[#04222A] shadow-[0_8px_30px_-8px_rgba(20,247,254,0.5)]"
        >
          {mobileMenuOpen ? (
            <X className="size-5" weight="bold" />
          ) : (
            <List className="size-5" weight="bold" />
          )}
        </Button>
      </div>

      {/* ===== Overlay do menu mobile ===== */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 overflow-y-auto bg-[#030d18]/95 pt-20 backdrop-blur-md lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="p-6">
            <h3 className="mb-4 text-lg font-bold">Navegação</h3>
            <div className="space-y-2">
              {sections.map((section) => {
                const SectionIcon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="hover:bg-brand-cyan/10 flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                  >
                    <SectionIcon
                      className="text-brand-cyan size-4 shrink-0"
                      weight="duotone"
                    />
                    <span className="text-sm">{section.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto flex max-w-7xl gap-6 px-4 sm:px-6">
        {/* ===== Sumário lateral (desktop) ===== */}
        <aside className="hidden w-64 shrink-0 py-10 lg:block">
          <div className="glass-card sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl p-5">
            <h3 className="mb-4 text-lg font-bold">Navegação</h3>
            {navigation}
          </div>
        </aside>

        {/* ===== Conteúdo principal ===== */}
        <div className="min-w-0 flex-1 py-10 sm:py-12">
          {/* Logo */}
          <div className="mb-10 flex justify-center">
            <Link href="/" aria-label="Clipfy League">
              <Logo
                width={160}
                height={40}
                shadow={false}
                className="h-9 w-auto drop-shadow-[0_0_24px_rgba(20,247,254,0.3)] sm:h-10"
              />
            </Link>
          </div>

          {/* Header */}
          <div id="intro" className="animate-fade-in-up mb-12 text-center">
            <div className="bg-gradient-custom mb-4 inline-flex size-16 items-center justify-center rounded-full shadow-[0_10px_40px_-10px_rgba(20,247,254,0.55)]">
              <Scales className="size-8 text-[#04222A]" weight="fill" />
            </div>
            <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Regulamento <span className="text-gradient">Geral</span>
            </h1>
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <Badge
                variant="outline"
                className="border-brand-cyan/30 text-brand-cyan rounded-full text-sm"
              >
                CLIPFY LEAGUE
              </Badge>
              <Badge variant="outline" className="rounded-full text-sm">
                Última atualização: 2026
              </Badge>
            </div>
            <p className="text-muted-foreground mx-auto max-w-3xl">
              Plataforma:{" "}
              <a
                href="https://league.clipfyai.com"
                className="text-brand-cyan hover:underline"
              >
                league.clipfyai.com
              </a>
            </p>
          </div>

          {/* Aviso Importante */}
          <div className="glass-card mb-8 rounded-3xl p-6 ring-1 ring-amber-500/30">
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                <Warning className="size-5 text-amber-400" weight="fill" />
              </span>
              <div className="min-w-0">
                <h3 className="mb-2 text-lg font-semibold">Âmbito</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Este Regulamento estabelece as regras operacionais de
                  participação, envio, avaliação, auditoria, premiação e
                  pagamento (incluindo prazos, documentos e condições) para
                  todas as Competições da Clipfy League. Em caso de conflito, o
                  Regulamento Específico de uma competição prevalece sobre o
                  presente, naquilo que diferir, complementando-se mutuamente.
                </p>
              </div>
            </div>
          </div>

          {/* Organizadora */}
          <div className="glass-card mb-8 rounded-3xl p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className="bg-brand-cyan/15 flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Shield className="text-brand-cyan size-5" weight="fill" />
              </span>
              <div className="min-w-0 space-y-2">
                <h3 className="text-lg font-semibold">Organizadora</h3>
                <p className="text-muted-foreground text-sm">
                  <strong className="text-foreground">
                    CLIPFY SOFTWARES TECNOLOGIA LTDA
                  </strong>
                  <br />
                  (&quot;Clipfy&quot;)
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo do Regulamento */}
          <div className="glass-card mb-8 rounded-3xl p-5 leading-relaxed sm:p-8 lg:p-10">
            {/* 1. Definições */}
            <div id="definicoes" className="scroll-mt-24">
              <SectionTitle number="1">Definições Rápidas</SectionTitle>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <InfoCell title="Clipador">
                  Usuário concorrente, editor responsável pela criação/edição
                  dos cortes.
                </InfoCell>
                <InfoCell title="Post">
                  Vídeo curto publicado fora da Plataforma cujo link público é
                  cadastrado na Liga.
                </InfoCell>
                <InfoCell title="Envio">
                  Ato de registrar na Plataforma os dados do post (link +
                  metadados exigidos).
                </InfoCell>
                <InfoCell title="Métricas">
                  Dados públicos ou comprováveis (ex.: views, retenção,
                  engajamento).
                </InfoCell>
                <InfoCell title="Homologação">
                  Validação final (conferência + auditoria) das
                  entregas/métricas.
                </InfoCell>
                <InfoCell title="Resultado Oficial">
                  Ranking final homologado e divulgado pela Clipfy.
                </InfoCell>
                <InfoCell title="SLA">
                  Prazos operacionais-alvo para análise, resposta e pagamento.
                </InfoCell>
                <InfoCell title="Dias úteis">
                  De segunda a sexta, exceto feriados nacionais/bancários no
                  Brasil.
                </InfoCell>
              </div>
            </div>

            <Separator className="my-8" />

            {/* 2. Elegibilidade */}
            <div id="elegibilidade" className="scroll-mt-24">
              <SectionTitle number="2">Elegibilidade e Cadastro</SectionTitle>
              <p className="mb-2">
                <strong>2.1.</strong> Idade mínima: 18 anos completos.
              </p>
              <p className="mb-2">
                <strong>2.2.</strong> Conta única e intransferível. É vedado
                compartilhamento de credenciais.
              </p>
              <p className="mb-2">
                <strong>2.3.</strong> Verificação/KYC: a Clipfy pode solicitar
                documentos e provas de titularidade das contas de redes sociais
                usadas nos posts.
              </p>
              <p className="mb-6">
                <strong>2.4.</strong> Perfis privados: posts de perfis privados
                podem ser desconsiderados se dificultarem verificação/validação.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 3. Escopo */}
            <div id="escopo" className="scroll-mt-24">
              <SectionTitle number="3">Escopo e Limitações</SectionTitle>
              <p className="mb-2">
                <strong>3.1.</strong> A Liga é focada exclusivamente em edição.
                A Plataforma não publica nem gerencia contas em redes sociais.
              </p>
              <p className="mb-6">
                <strong>3.2.</strong> O Clipador apenas registra os links dos
                posts publicados em suas próprias contas (ou contas de terceiros
                com autorização expressa e verificável).
              </p>
            </div>

            <Separator className="my-8" />

            {/* 4. Inscrição */}
            <div id="inscricao" className="scroll-mt-24">
              <SectionTitle number="4">
                Inscrição e Cronograma Padrão
              </SectionTitle>
              <p className="mb-3">
                <strong>4.1.</strong> Cada competição terá período de inscrição
                e janela de envio definidos no Regulamento Específico.
              </p>
              <p className="mb-3">
                <strong>4.2.</strong> Cronograma operacional sugerido
                (baseline):
              </p>
              <div className="border-border/60 bg-muted/20 mb-4 space-y-2 rounded-2xl border p-4">
                <p className="text-sm">
                  <strong className="text-brand-cyan">T0</strong> — Encerramento
                  da competição (data/hora-limite de envio).
                </p>
                <p className="text-sm">
                  <strong className="text-brand-cyan">T0 ~ T0+48h</strong> —
                  Janela de checagens preliminares (consistência, links,
                  duplicidade).
                </p>
                <p className="text-sm">
                  <strong className="text-brand-cyan">T0+48h ~ T0+120h</strong>{" "}
                  — Auditoria e validações (se necessário).
                </p>
                <p className="text-sm">
                  <strong className="text-brand-cyan">T0+120h</strong> —
                  Publicação do Resultado Oficial (comunicação na Plataforma).
                </p>
                <p className="text-sm">
                  <strong className="text-brand-mint">Pagamento</strong> — Até 7
                  (sete) dias úteis após o fim da competição (ver Seção 13),
                  salvo retenção por suspeita de fraude ou pendências
                  documentais.
                </p>
              </div>
              <p className="text-muted-foreground mb-6 text-sm">
                <strong>Observação:</strong> o baseline acima é uma referência
                para transparência; a organização pode encurtar etapas conforme
                volume/complexidade se tudo estiver claro.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 5. Envio de Posts */}
            <div id="envio" className="scroll-mt-24">
              <SectionTitle number="5">
                Envio de Posts (Submissões)
              </SectionTitle>
              <p className="mb-2">
                <strong>5.1.</strong> Onde: o envio é feito no painel da
                competição (Plataforma).
              </p>
              <p className="mb-2">
                <strong>5.2.</strong> O que enviar (pode variar por competição,
                mas em geral):
              </p>
              <ul className="mb-3 list-disc space-y-1 pl-6">
                <li>Link público do post (URL completa).</li>
                <li>Plataforma (Instagram/TikTok/YouTube).</li>
                <li>Data/hora da publicação.</li>
                <li>
                  Campos adicionais exigidos (hashtags/descrição/tema, quando
                  houver).
                </li>
              </ul>
              <p className="mb-2">
                <strong>5.3.</strong> Autoria e titularidade:
              </p>
              <ul className="mb-3 list-disc space-y-1 pl-6">
                <li>
                  O post deve ser fruto de edição realizada pelo próprio
                  Clipador.
                </li>
                <li>
                  O post deve estar em conta de titularidade do Clipador ou
                  autorizada pelo titular (a Clipfy pode exigir prova).
                </li>
              </ul>
              <p className="mb-2">
                <strong>5.4.</strong> Repetição de conteúdo:
              </p>
              <ul className="mb-3 list-disc space-y-1 pl-6">
                <li>
                  Não há limite de quantidade de posts, salvo regra específica;
                </li>
                <li>
                  Conteúdos repetidos (mesmo corte reaproveitado de forma
                  idêntica) podem ser reprovados; reincidência pode levar a
                  eliminação.
                </li>
              </ul>
              <p className="mb-6">
                <strong>5.5.</strong> Links inválidos: URLs quebradas, posts
                deletados ou com restrições de visualização podem ser
                desconsiderados.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 6. Conteúdo */}
            <div id="conteudo" className="scroll-mt-24">
              <SectionTitle number="6">Conteúdo e Conformidade</SectionTitle>
              <p className="mb-2">
                <strong>6.1.</strong> Proibido: violação de direitos autorais,
                uso não licenciado de marcas/músicas/imagem/voz, nudez
                explícita, ódio/assédio, apologia a crimes, dados sensíveis de
                terceiros, desinformação deliberada, promoção de
                produtos/serviços proibidos.
              </p>
              <p className="mb-2">
                <strong>6.2.</strong> Direitos de terceiros: o Clipador é
                responsável por todas as autorizações necessárias.
              </p>
              <p className="mb-6">
                <strong>6.3.</strong> Termos de terceiros: é obrigatório seguir
                as regras do Instagram/TikTok/YouTube etc.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 7. Antifraude */}
            <div id="antifraude" className="scroll-mt-24">
              <SectionTitle number="7">
                Antifraude (Regras Centrais)
              </SectionTitle>
              <p className="mb-3">
                <strong>7.1.</strong> É expressamente proibido:
              </p>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  Comprar/gerar views/likes/comentários artificialmente, usar
                  bots, pods, scripts não permitidos;
                </li>
                <li>
                  Mascarar IP/geo com intenção de manipular alcance quando
                  vedado;
                </li>
                <li>
                  Enviar links de contas que não são suas sem autorização
                  válida;
                </li>
                <li>
                  Repostar o mesmo corte repetidas vezes apenas para inflar
                  &quot;quantidade&quot;;
                </li>
                <li>
                  Fornecer informações falsas em cadastros, evidências ou
                  relatórios.
                </li>
              </ul>
              <p className="mb-2">
                <strong>7.2.</strong> Sinais de fraude incluem (exemplos): picos
                antinaturais, divergência entre analytics oficiais e declarados,
                contas recém-criadas sem lastro e tráfego incomum.
              </p>
              <p className="mb-6">
                <strong>7.3.</strong> Medidas: remoção de posts, anulação de
                métricas, perda de pontos/premiação, suspensão/banimento,
                comunicação às autoridades quando couber.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 8. Avaliação */}
            <div id="avaliacao" className="scroll-mt-24">
              <SectionTitle number="8">
                Critérios de Avaliação e Pontuação
              </SectionTitle>
              <p className="mb-2">
                <strong>8.1.</strong> As competições podem combinar Qualidade +
                Quantidade (peso e fórmula definidos no regulamento específico).
              </p>
              <p className="mb-2">
                <strong>8.2.</strong> Qualidade (exemplos): narrativa do corte,
                ritmo/tempo, legendas, clareza visual, cortes limpos, áudio,
                adequação ao tema/briefing.
              </p>
              <p className="mb-2">
                <strong>8.3.</strong> Quantidade: volume de entregas válidas
                (sem repetição vedada/links quebrados).
              </p>
              <p className="mb-2">
                <strong>8.4.</strong> Métricas públicas podem ser consideradas
                como referência indicativa, sujeitas à homologação.
              </p>
              <p className="mb-6">
                <strong>8.5.</strong> A organização pode desconsiderar métricas
                consideradas anômalas/suspeitas.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 9. Auditoria */}
            <div id="auditoria" className="scroll-mt-24">
              <SectionTitle number="9">
                Auditoria, Evidências e Homologação
              </SectionTitle>
              <p className="mb-2">
                <strong>9.1.</strong> A Clipfy pode solicitar provas: prints dos
                analytics nativos, arquivos do projeto de edição, lista de
                fontes/músicas, comprovação de titularidade da conta,
                autorização do titular (se não for sua).
              </p>
              <p className="mb-2">
                <strong>9.2.</strong> Prazo de envio das evidências: será
                indicado na notificação; a falta de envio no prazo pode gerar
                desclassificação.
              </p>
              <p className="mb-6">
                <strong>9.3.</strong> Homologação: o Resultado Oficial só é
                divulgado após a conclusão das validações e auditorias
                necessárias.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 10. Empates */}
            <div id="empates" className="scroll-mt-24">
              <SectionTitle number="10">Empates (Desempate)</SectionTitle>
              <p className="mb-3">
                <strong>10.1.</strong> Regra padrão (na ausência de regra
                específica da competição):
              </p>
              <ol className="mb-3 list-decimal space-y-1 pl-6">
                <li>Maior nota de Qualidade;</li>
                <li>Maior número de entregas válidas;</li>
                <li>Data/hora do primeiro post válido (mais antigo vence).</li>
              </ol>
              <p className="mb-6">
                <strong>10.2.</strong> Persistindo o empate, a Clipfy poderá
                declarar empate técnico e dividir a premiação prevista.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 11. Penalidades */}
            <div id="penalidades" className="scroll-mt-24">
              <SectionTitle number="11">Penalidades e Recursos</SectionTitle>
              <p className="mb-2">
                <strong>11.1.</strong> Penalidades: advertência, remoção de
                posts, perda de pontos, exclusão da competição, banimento da
                Liga, cancelamento/estorno de premiação irregular.
              </p>
              <p className="mb-6">
                <strong>11.2.</strong> Recurso/Apelação: o Clipador pode
                apresentar recurso pelo canal indicado em até 72h após a
                notificação ou divulgação do resultado (salvo prazo diverso
                informado). A decisão da Clipfy é final no âmbito da Liga.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 12. Premiação */}
            <div id="premiacao" className="scroll-mt-24">
              <SectionTitle number="12">Premiação (Visão Geral)</SectionTitle>
              <p className="mb-2">
                <strong>12.1.</strong> A premiação (valores, prêmios, critérios
                de distribuição) será definida no Regulamento Específico da
                competição.
              </p>
              <p className="mb-2">
                <strong>12.2.</strong> A Clipfy pode exigir documentos antes da
                liberação (ver Seção 13).
              </p>
              <p className="mb-6">
                <strong>12.3.</strong> A organização poderá recalcular e
                republicar resultados se identificar erro material óbvio ou
                fraude sobreveniente, inclusive após a divulgação.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 13. Pagamento */}
            <div id="pagamento" className="scroll-mt-24">
              <SectionTitle number="13">
                Regras de Pagamento (PRINCIPAIS)
              </SectionTitle>

              <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
                <p className="text-sm">
                  <strong>Prazo central (SLA):</strong> o pagamento das
                  premiações será efetuado até 7 (sete) dias úteis após o fim da
                  competição (T0), desde que:
                </p>
                <ul className="mt-2 list-none space-y-1 pl-4 text-sm">
                  <li>(i) não haja indícios de fraude pendentes de análise;</li>
                  <li>
                    (ii) todos os documentos exigidos tenham sido entregues e
                    aprovados;
                  </li>
                  <li>(iii) os dados bancários estejam corretos;</li>
                  <li>
                    (iv) não haja impedimento legal (ex.: ordem judicial,
                    sanção).
                  </li>
                </ul>
              </div>

              <h3 className="mb-3 text-lg font-semibold sm:text-xl">
                13.1. Moeda e meios de pagamento
              </h3>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  <strong>Moeda padrão:</strong> BRL (R$).
                </li>
                <li>
                  <strong>Meios:</strong> PIX (preferencial),
                  TED/Transferência.
                </li>
                <li>
                  A Clipfy pode, a seu critério, oferecer outras modalidades ou
                  parcelar pagamentos em casos excepcionais (será comunicado).
                </li>
              </ul>

              <h3 className="mb-3 text-lg font-semibold sm:text-xl">
                13.2. Destinatário do pagamento
              </h3>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  Pagamento exclusivamente ao titular vencedor (CPF/CNPJ
                  cadastrado).
                </li>
                <li>
                  É vedada a cessão a terceiros sem autorização expressa da
                  Clipfy (cedência pode exigir termo específico + comprovações).
                </li>
              </ul>

              <h3 className="mb-3 text-lg font-semibold sm:text-xl">
                13.3. Documentos obrigatórios
              </h3>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                  <p className="mb-2 font-semibold">Pessoa Física (PF)</p>
                  <ul className="space-y-1 text-sm">
                    <li>• Documento oficial com foto + CPF</li>
                    <li>• Chave PIX (preferencial) ou dados bancários</li>
                    <li>• RPA/recibo quando solicitado</li>
                  </ul>
                </div>
                <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                  <p className="mb-2 font-semibold">Pessoa Jurídica (PJ)</p>
                  <ul className="space-y-1 text-sm">
                    <li>• CNPJ ativo</li>
                    <li>• Contrato/Estatuto ou Cartão CNPJ</li>
                    <li>• NF-e emitida conforme instrução</li>
                    <li>• Dados bancários da PJ</li>
                  </ul>
                </div>
              </div>

              <p className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <strong>Importante:</strong> A contagem do prazo &quot;até 7
                dias úteis após o fim&quot; pressupõe a entrega correta e
                tempestiva da documentação. Documentos entregues após T0 podem
                postergar o pagamento até o próximo ciclo operacional viável.
              </p>

              <h3 className="mb-3 text-lg font-semibold sm:text-xl">
                13.4. Retenções, glosas e impedimentos
              </h3>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  Havendo suspeita de fraude, o pagamento poderá ser retido até
                  a conclusão da auditoria.
                </li>
                <li>
                  Identificada fraude/violação, a premiação pode ser cancelada.
                </li>
                <li>
                  Divergência de titularidade dos dados bancários suspende o
                  pagamento até regularização.
                </li>
                <li>
                  Se houver ordem judicial ou obrigação legal impeditiva, o
                  valor poderá ser retido até solução.
                </li>
              </ul>
              <p className="text-muted-foreground mb-4 text-sm">
                <strong>13.4.1.</strong> Se a Clipfy decidir encerrar uma
                competição de forma antecipada, os valores já devidos das
                premiações diárias homologadas serão pagos, juntamente com o
                valor proporcional referente ao Ranking Mensal (ou ao período
                efetivamente realizado), conforme o cálculo definido para a
                competição.
              </p>

              <h3 className="mb-3 text-lg font-semibold sm:text-xl">
                13.5. Tributação e encargos
              </h3>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  O Clipador é responsável pelos impostos e obrigações
                  fiscais/previdenciárias incidentes.
                </li>
                <li>
                  Quando a legislação exigir, poderá haver retenções na fonte
                  (ex.: IRRF, INSS).
                </li>
                <li>
                  Custos bancários incomuns podem ser descontados do valor a
                  receber.
                </li>
              </ul>

              <h3 className="mb-3 text-lg font-semibold sm:text-xl">
                13.6. Erros operacionais e reprocessamento
              </h3>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  Dados bancários incorretos que causem devolução implicam
                  reagendamento do pagamento.
                </li>
                <li>
                  Em caso de erro material da Clipfy, poderá haver ajuste
                  (complemento/estorno).
                </li>
              </ul>

              <h3 className="mb-3 text-lg font-semibold sm:text-xl">
                13.7. Comprovante e transparência
              </h3>
              <ul className="mb-6 list-disc space-y-1 pl-6">
                <li>
                  A Clipfy disponibilizará comprovante (PIX/TED) no painel ou
                  por e-mail.
                </li>
                <li>
                  O painel pode exibir status: &quot;Aguardando
                  Documentos&quot;, &quot;Em Validação&quot;, &quot;Pagamento
                  Agendado&quot;, &quot;Pago&quot;.
                </li>
              </ul>
            </div>

            <Separator className="my-8" />

            {/* 14. Comunicação */}
            <div id="comunicacao" className="scroll-mt-24">
              <SectionTitle number="14">
                Comunicação de Resultados
              </SectionTitle>
              <p className="mb-2">
                <strong>14.1.</strong> O Resultado Oficial será divulgado na
                Plataforma (e/ou e-mail/notificação).
              </p>
              <p className="mb-2">
                <strong>14.2.</strong> Em caso de ajustes por erro material
                óbvio, a Clipfy republicará o resultado.
              </p>
              <p className="mb-6">
                <strong>14.3.</strong> Janela de recurso: até 72h a partir da
                publicação do Resultado Oficial (salvo regra específica).
              </p>
            </div>

            <Separator className="my-8" />

            {/* 15. Suporte */}
            <div id="suporte" className="scroll-mt-24">
              <SectionTitle number="15">Suporte e Canais</SectionTitle>
              <p className="mb-2">
                <strong>15.1.</strong> Dúvidas e suporte via help desk indicado
                no rodapé da Plataforma.
              </p>
              <p className="mb-2">
                <strong>15.2.</strong> Para pagamentos, use o assunto
                &quot;Pagamento — [Nome da Competição] — [Seu @]&quot; e
                inclua:
              </p>
              <ul className="mb-6 list-disc space-y-1 pl-6">
                <li>
                  Nome completo/razão social; CPF/CNPJ; chave PIX/dados
                  bancários;
                </li>
                <li>Tipo (PF/PJ); documentos anexos;</li>
                <li>ID da competição e colocação.</li>
              </ul>
            </div>

            <Separator className="my-8" />

            {/* 16. Privacidade */}
            <div id="privacidade" className="scroll-mt-24">
              <SectionTitle number="16">Privacidade e Dados</SectionTitle>
              <p className="mb-2">
                <strong>16.1.</strong> Tratamento de dados conforme Política de
                Privacidade e LGPD.
              </p>
              <p className="mb-6">
                <strong>16.2.</strong> Dados de pagamento/documentos ficam
                armazenados pelo prazo legal necessário (compliance, defesa e
                auditoria).
              </p>
            </div>

            <Separator className="my-8" />

            {/* 17. Disposições */}
            <div id="disposicoes" className="scroll-mt-24">
              <SectionTitle number="17">
                Alterações, Força Maior e Disposições Finais
              </SectionTitle>
              <p className="mb-2">
                <strong>17.1.</strong> A Clipfy pode atualizar este Regulamento
                para aperfeiçoamentos operacionais. A versão vigente sempre
                constará na Plataforma.
              </p>
              <p className="mb-2">
                <strong>17.2.</strong> Eventos de força maior (indisponibilidade
                de APIs, panes bancárias, feriados extraordinários etc.) podem
                afetar prazos; a Clipfy comunicará quando cabível.
              </p>
              <p className="mb-6">
                <strong>17.3.</strong> A participação implica ciência e
                concordância com este Regulamento e com os Termos de Uso.
              </p>
            </div>
          </div>

          {/* ===== Anexos ===== */}
          <div id="anexos" className="mb-12 scroll-mt-24 space-y-6">
            {/* Anexo A */}
            <div className="glass-card ring-brand-cyan/30 rounded-3xl p-6 ring-1">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <CheckCircle
                  className="text-brand-cyan size-6 shrink-0"
                  weight="fill"
                />
                ANEXO A — Checklist de Conformidade do Envio
              </h3>
              <div className="space-y-2">
                {[
                  "Post é minha edição e atende ao tema/briefing.",
                  "Post está em conta minha ou autorizada (posso comprovar).",
                  "Link público e funcional (não privado, não deletado).",
                  "Sem repetição indevida do mesmo corte.",
                  "Não usei bots/compra de métricas; não mascarei IP/geo indevidamente.",
                  "Tenho evidências (prints analytics, arquivo do projeto, fontes/músicas licenciadas).",
                  "Respeitei termos das plataformas (IG/TikTok/YouTube).",
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <CheckCircle
                      className="mt-0.5 size-5 shrink-0 text-emerald-400"
                      weight="fill"
                    />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Anexo B */}
            <div className="glass-card rounded-3xl p-6 ring-1 ring-sky-500/30">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <Clock className="size-6 shrink-0 text-sky-400" weight="fill" />
                ANEXO B — Fluxo de Apuração &amp; Pagamento (Linha do Tempo)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="shrink-0 font-bold text-sky-400">T0</span>
                  <span>Fim da competição (encerra envio).</span>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 font-bold text-sky-400">
                    T0 ~ T0+48h
                  </span>
                  <span>
                    Checagem preliminar: validação de links e elegibilidade
                    básica.
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 font-bold text-sky-400">
                    T0+48h ~ T0+120h
                  </span>
                  <span>
                    Auditoria por amostragem ou dirigida (se necessário).
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 font-bold text-sky-400">
                    T0+120h
                  </span>
                  <span>Publicação do Resultado Oficial.</span>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 font-bold text-emerald-400">
                    Pagamentos
                  </span>
                  <span>
                    Até D+7 dias úteis a contar de T0 (desde que sem suspeita de
                    fraude e com documentação ok).
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 font-bold text-amber-400">
                    Pendências
                  </span>
                  <span>
                    Se houver suspeita/documentação faltante, o pagamento fica
                    suspenso até a regularização.
                  </span>
                </div>
              </div>
              <div className="border-border/60 bg-muted/30 mt-4 rounded-2xl border p-3 text-xs">
                <strong>Exemplo prático:</strong> Competição encerra
                sexta-feira (T0). Pagamento até segunda da semana seguinte + 4
                dias úteis (ou seja, até a terça/quarta da outra semana,
                dependendo de feriados), se não houver pendências.
              </div>
            </div>

            {/* Anexo C */}
            <div className="glass-card rounded-3xl p-6 ring-1 ring-emerald-500/30">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <CurrencyDollar
                  className="size-6 shrink-0 text-emerald-400"
                  weight="bold"
                />
                ANEXO C — Documentos para Pagamento
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="border-border/60 rounded-2xl border p-4">
                  <p className="mb-3 font-semibold">PF (Pessoa Física)</p>
                  <ul className="space-y-2 text-sm">
                    <li>• Documento com foto + CPF</li>
                    <li>• Chave PIX (preferencial) ou dados bancários</li>
                    <li>
                      • RPA/recibo quando solicitado (modelo fornecido pela
                      Clipfy)
                    </li>
                  </ul>
                </div>
                <div className="border-border/60 rounded-2xl border p-4">
                  <p className="mb-3 font-semibold">PJ (Pessoa Jurídica)</p>
                  <ul className="space-y-2 text-sm">
                    <li>• CNPJ ativo</li>
                    <li>• Contrato/Estatuto ou Cartão CNPJ</li>
                    <li>
                      • NF-e conforme instruções da Clipfy (quando aplicável)
                    </li>
                    <li>• Dados bancários da PJ</li>
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-sm text-amber-400">
                <strong>Atenção:</strong> divergência de titularidade (ex.:
                chave em nome de terceiro) impede o pagamento até correção.
              </p>
            </div>

            {/* Anexo D */}
            <div className="glass-card rounded-3xl p-6 ring-1 ring-red-500/30">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <Warning
                  className="size-6 shrink-0 text-red-400"
                  weight="fill"
                />
                ANEXO D — Causas Comuns de Retenção/Cancelamento
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-red-400">•</span>
                  <span>
                    <strong>Fraude:</strong> compra de engajamento, bots, pods,
                    IP/geo mascarado indevido.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-red-400">•</span>
                  <span>Repetição massiva de conteúdo idêntico.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-red-400">•</span>
                  <span>
                    Links inválidos/privados/deletados no momento da
                    conferência.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-red-400">•</span>
                  <span>
                    Incompatibilidade entre analytics oficiais e declarados.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-red-400">•</span>
                  <span>
                    Documentação incompleta ou dados bancários divergentes.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-red-400">•</span>
                  <span>NF-e emitida em desacordo (PJ) e não corrigida.</span>
                </li>
              </ul>
            </div>

            {/* Anexo E */}
            <div className="glass-card rounded-3xl p-6 ring-1 ring-violet-500/30">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <Scales
                  className="size-6 shrink-0 text-violet-400"
                  weight="fill"
                />
                ANEXO E — Modelo de Recurso (Sumário)
              </h3>
              <div className="space-y-3 text-sm">
                <p>
                  <strong>1.</strong> Identificação do Clipador
                  (nome/CPF/CNPJ/@).
                </p>
                <p>
                  <strong>2.</strong> Competição e post(s) questionado(s) com
                  links.
                </p>
                <p>
                  <strong>3.</strong> Fatos e fundamentos objetivos (prints,
                  explicações técnicas).
                </p>
                <p>
                  <strong>4.</strong> Pedido: recontagem, revalidação,
                  reconsideração de penalidade etc.
                </p>
                <p className="text-amber-400">
                  <strong>Prazo:</strong> Enviar em até 72h da publicação do
                  Resultado Oficial (salvo regra diversa).
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-muted-foreground pb-4 text-center text-sm">
            <p>
              © 2026 Clipfy Softwares Tecnologia LTDA. Todos os direitos
              reservados.
            </p>
          </div>
        </div>
      </div>
    </DarkScope>
  )
}
