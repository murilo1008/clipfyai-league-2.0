"use client"

import * as React from "react"
import Link from "next/link"
import {
  CheckCircle,
  Clock,
  Cookie,
  Database,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  FileText,
  Gear,
  Globe,
  HardDrives,
  Key,
  List,
  Lock,
  Scales,
  ShareNetwork,
  Shield,
  Trash,
  UserCheck,
  UserMinus,
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
  { id: "intro", title: "Introdução", icon: Shield },
  { id: "controladora", title: "1. Controladora", icon: FileText },
  { id: "definicoes", title: "2. Definições", icon: Database },
  { id: "dados-coletados", title: "3. Dados Coletados", icon: Eye },
  { id: "finalidades", title: "4. Finalidades", icon: Gear },
  { id: "base-legal", title: "5. Base Legal", icon: Scales },
  { id: "compartilhamento", title: "6. Compartilhamento", icon: ShareNetwork },
  { id: "armazenamento", title: "7. Armazenamento", icon: HardDrives },
  { id: "seguranca", title: "8. Segurança", icon: Lock },
  { id: "direitos", title: "9. Seus Direitos", icon: UserCheck },
  { id: "cookies", title: "10. Cookies", icon: Cookie },
  { id: "menores", title: "11. Menores de Idade", icon: UserMinus },
  { id: "transferencia", title: "12. Transferência Internacional", icon: Globe },
  { id: "alteracoes", title: "13. Alterações", icon: Clock },
  { id: "contato", title: "14. Contato/DPO", icon: EnvelopeSimple },
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

/** Título de seção da política. */
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

/** Cartão de categoria de dados (Seção 3). */
function DataCategory({
  icon: CategoryIcon,
  title,
  children,
}: {
  icon: Icon
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
      <h4 className="mb-2 flex items-center gap-2 font-semibold">
        <CategoryIcon className="text-brand-cyan size-4 shrink-0" weight="duotone" />
        {title}
      </h4>
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  )
}

/** Item da lista de direitos do titular (Seção 9). */
function RightItem({
  icon: RightIcon,
  children,
}: {
  icon: Icon
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <RightIcon
        className="text-brand-cyan mt-0.5 size-5 shrink-0"
        weight="duotone"
      />
      <div>{children}</div>
    </div>
  )
}

export default function PrivacyPolicy() {
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
          <div id="intro" className="animate-fade-in-up mb-12 scroll-mt-24 text-center">
            <div className="bg-gradient-custom mb-4 inline-flex size-16 items-center justify-center rounded-full shadow-[0_10px_40px_-10px_rgba(20,247,254,0.55)]">
              <Shield className="size-8 text-[#04222A]" weight="fill" />
            </div>
            <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Política de <span className="text-gradient">Privacidade</span>
            </h1>
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <Badge
                variant="outline"
                className="border-brand-cyan/30 text-brand-cyan rounded-full text-sm"
              >
                CLIPFY LEAGUE
              </Badge>
              <Badge variant="outline" className="rounded-full text-sm">
                Conforme LGPD (Lei 13.709/2018)
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
          <div className="glass-card ring-brand-cyan/30 mb-8 rounded-3xl p-6 ring-1">
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className="bg-brand-cyan/15 flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Shield className="text-brand-cyan size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <h3 className="mb-2 text-lg font-semibold">
                  Compromisso com sua Privacidade
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  A Clipfy respeita sua privacidade e está comprometida com a
                  proteção de seus dados pessoais. Esta Política explica como
                  coletamos, usamos, armazenamos e protegemos suas informações,
                  em conformidade com a Lei Geral de Proteção de Dados (LGPD) e
                  demais normas aplicáveis.
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo da Política */}
          <div className="glass-card mb-8 rounded-3xl p-5 leading-relaxed sm:p-8 lg:p-10">
            {/* 1. Controladora */}
            <div id="controladora" className="scroll-mt-24">
              <SectionTitle number="1">Controladora de Dados</SectionTitle>
              <p className="mb-3">
                <strong>1.1.</strong> A controladora e operadora dos dados
                pessoais coletados por meio da Clipfy League é:
              </p>
              <div className="border-border/60 bg-muted/20 mb-6 rounded-2xl border p-4">
                <p className="mb-1">
                  <strong>CLIPFY SOFTWARES TECNOLOGIA LTDA</strong>
                </p>
                <p className="mb-1">CNPJ: 59.769.545/0001-00</p>
                <p className="mb-1">
                  Endereço: Rua Noronha Torrezão, nº 24, sala 1009, Santa Rosa
                </p>
                <p className="mb-1">Niterói/RJ – CEP 24240-182</p>
                <p className="mb-1">
                  E-mail:{" "}
                  <a
                    href="mailto:legal@clipfyai.com"
                    className="text-brand-cyan hover:underline"
                  >
                    legal@clipfyai.com
                  </a>
                </p>
              </div>
              <p className="mb-6">
                <strong>1.2.</strong> Para questões relacionadas à proteção de
                dados e exercício de direitos (LGPD), entre em contato pelo
                canal indicado na seção 14.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 2. Definições */}
            <div id="definicoes" className="scroll-mt-24">
              <SectionTitle number="2">Definições</SectionTitle>
              <p className="mb-3">Para fins desta Política:</p>
              <ul className="mb-6 list-none space-y-2 pl-0">
                <li>
                  <strong>Dados Pessoais:</strong> informação relacionada a
                  pessoa natural identificada ou identificável.
                </li>
                <li>
                  <strong>Titular:</strong> pessoa natural a quem se referem os
                  dados pessoais (você, o Clipador).
                </li>
                <li>
                  <strong>Tratamento:</strong> toda operação com dados pessoais
                  (coleta, armazenamento, uso, compartilhamento, eliminação
                  etc.).
                </li>
                <li>
                  <strong>Controladora:</strong> a Clipfy, responsável pelas
                  decisões sobre o tratamento.
                </li>
                <li>
                  <strong>Operadora:</strong> quem realiza o tratamento em nome
                  da Controladora.
                </li>
                <li>
                  <strong>LGPD:</strong> Lei nº 13.709/2018 (Lei Geral de
                  Proteção de Dados).
                </li>
                <li>
                  <strong>ANPD:</strong> Autoridade Nacional de Proteção de
                  Dados.
                </li>
              </ul>
            </div>

            <Separator className="my-8" />

            {/* 3. Dados Coletados */}
            <div id="dados-coletados" className="scroll-mt-24">
              <SectionTitle number="3">Dados Pessoais Coletados</SectionTitle>
              <p className="mb-3">
                <strong>3.1.</strong> Coletamos e tratamos as seguintes
                categorias de dados pessoais:
              </p>

              <div className="mb-6 space-y-4">
                <DataCategory
                  icon={UserCheck}
                  title="Dados de Identificação e Contato"
                >
                  Nome completo, CPF, e-mail, telefone, data de nascimento,
                  endereço, foto de perfil.
                </DataCategory>

                <DataCategory icon={Lock} title="Dados de Cadastro e Acesso">
                  Login, senha criptografada, preferências de conta, histórico
                  de acesso.
                </DataCategory>

                <DataCategory icon={Globe} title="Dados de Redes Sociais">
                  Perfis vinculados (Instagram, TikTok, YouTube), @ (username),
                  URLs de posts, prints de analytics, dados públicos das
                  plataformas.
                </DataCategory>

                <DataCategory icon={Database} title="Dados de Participação">
                  Links de posts cadastrados, métricas (views, likes, watch
                  time, retenção etc.), pontuação, ranking, histórico de
                  competições, premiações recebidas.
                </DataCategory>

                <DataCategory
                  icon={HardDrives}
                  title="Dados de Navegação e Dispositivo"
                >
                  Endereço IP, user-agent, tipo de navegador, sistema
                  operacional, cookies, data/hora de acesso, páginas visitadas,
                  ações realizadas na Plataforma.
                </DataCategory>

                <DataCategory
                  icon={FileText}
                  title="Dados de Verificação e Conformidade"
                >
                  Documentos de identificação, comprovantes de titularidade de
                  contas, prints de telas, vídeos de verificação, arquivos de
                  projeto de edição, comunicações com suporte.
                </DataCategory>

                <DataCategory
                  icon={Key}
                  title="Dados Financeiros e de Pagamento"
                >
                  Dados bancários (banco, agência, conta, tipo de conta,
                  titular), chave PIX, CPF para pagamento, histórico de
                  transações/premiações, notas fiscais quando aplicável.
                </DataCategory>
              </div>

              <p className="mb-6">
                <strong>3.2.</strong> A coleta pode ocorrer diretamente (quando
                você fornece) ou de forma automática (logs, cookies, interações
                na Plataforma).
              </p>
            </div>

            <Separator className="my-8" />

            {/* 4. Finalidades */}
            <div id="finalidades" className="scroll-mt-24">
              <SectionTitle number="4">Finalidades do Tratamento</SectionTitle>
              <p className="mb-3">
                <strong>4.1.</strong> Utilizamos seus dados pessoais para as
                seguintes finalidades:
              </p>
              <ul className="mb-4 list-none space-y-2 pl-6">
                <li>
                  <strong>a)</strong> Cadastro e gerenciamento de conta: criar,
                  manter e gerenciar seu perfil na Plataforma;
                </li>
                <li>
                  <strong>b)</strong> Execução das Competições: habilitar
                  participação, receber e processar posts, calcular métricas,
                  gerar rankings, determinar vencedores;
                </li>
                <li>
                  <strong>c)</strong> Verificação e antifraude: validar
                  identidade, titularidade de contas, autoria de edições,
                  detectar e prevenir fraudes, manipulação de métricas e
                  violações dos Termos de Uso;
                </li>
                <li>
                  <strong>d)</strong> Auditoria e conformidade: realizar
                  análises de conformidade, responder a processos legais,
                  cumprir obrigações regulatórias;
                </li>
                <li>
                  <strong>e)</strong> Pagamento de premiações: processar
                  transferências, emitir recibos, cumprir obrigações fiscais e
                  contábeis;
                </li>
                <li>
                  <strong>f)</strong> Comunicação: enviar notificações sobre
                  conta, competições, resultados, avisos importantes, responder
                  solicitações de suporte;
                </li>
                <li>
                  <strong>g)</strong> Marketing (com consentimento): enviar
                  newsletters, novidades, promoções de competições, materiais
                  informativos;
                </li>
                <li>
                  <strong>h)</strong> Melhoria da Plataforma: analisar uso,
                  identificar problemas técnicos, desenvolver novas
                  funcionalidades, otimizar experiência do usuário;
                </li>
                <li>
                  <strong>i)</strong> Segurança: proteger a Plataforma contra
                  acessos não autorizados, ataques, abusos;
                </li>
                <li>
                  <strong>j)</strong> Exercício de direitos: defender a Clipfy
                  em processos judiciais, administrativos ou arbitrais;
                </li>
                <li>
                  <strong>k)</strong> Divulgação de resultados e portfólios:
                  exibir rankings, cases de sucesso, materiais promocionais
                  (sempre com menção ao perfil do Clipador, quando aplicável),
                  conforme licença concedida nos Termos de Uso.
                </li>
              </ul>
            </div>

            <Separator className="my-8" />

            {/* 5. Base Legal */}
            <div id="base-legal" className="scroll-mt-24">
              <SectionTitle number="5">Base Legal do Tratamento</SectionTitle>
              <p className="mb-3">
                <strong>5.1.</strong> Tratamos seus dados com base nas seguintes
                hipóteses legais (art. 7º da LGPD):
              </p>
              <ul className="mb-6 list-none space-y-2 pl-6">
                <li>
                  <strong>a) Execução de contrato:</strong> prestação do serviço
                  da Plataforma, participação em Competições, pagamento de
                  premiações (art. 7º, V);
                </li>
                <li>
                  <strong>b) Legítimo interesse:</strong> prevenção de fraudes,
                  segurança da Plataforma, análise de métricas, melhoria de
                  serviços, exercício de direitos em processos (art. 7º, IX e
                  X);
                </li>
                <li>
                  <strong>c) Cumprimento de obrigação legal/regulatória:</strong>{" "}
                  resposta a ordens judiciais, atendimento a requisições da
                  ANPD, cumprimento de obrigações fiscais e contábeis (art. 7º,
                  II);
                </li>
                <li>
                  <strong>d) Consentimento:</strong> quando solicitado
                  expressamente, para finalidades específicas como marketing,
                  cookies não essenciais e uso de imagem em materiais
                  promocionais (art. 7º, I).
                </li>
              </ul>
              <p className="mb-6">
                <strong>5.2.</strong> Quando o tratamento for baseado em
                consentimento, você poderá revogá-lo a qualquer momento pelos
                canais indicados na seção 14, sem prejuízo das atividades
                realizadas previamente.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 6. Compartilhamento */}
            <div id="compartilhamento" className="scroll-mt-24">
              <SectionTitle number="6">Compartilhamento de Dados</SectionTitle>
              <p className="mb-3">
                <strong>6.1.</strong> Podemos compartilhar seus dados pessoais
                com:
              </p>
              <ul className="mb-4 list-none space-y-2 pl-6">
                <li>
                  <strong>a) Prestadores de serviço (operadores):</strong>{" "}
                  provedores de infraestrutura em nuvem, hospedagem,
                  armazenamento, envio de e-mails, processamento de pagamentos,
                  ferramentas de analytics, plataformas de antifraude, suporte
                  técnico. Todos atuam sob contrato, com cláusulas de
                  confidencialidade e proteção de dados;
                </li>
                <li>
                  <strong>b) Parceiros de Competições:</strong> marcas,
                  influenciadores ou empresas que promovam competições
                  específicas, quando necessário para organização, validação e
                  entrega de premiações;
                </li>
                <li>
                  <strong>c) Autoridades públicas:</strong> quando exigido por
                  lei, ordem judicial, requisição de órgãos reguladores (ANPD,
                  Receita Federal, Ministério Público, Polícia);
                </li>
                <li>
                  <strong>d) Terceiros em operações societárias:</strong> em
                  casos de fusão, aquisição, venda de ativos ou reestruturação,
                  mediante manutenção das obrigações de proteção;
                </li>
                <li>
                  <strong>e) Defesa de direitos:</strong> advogados, peritos e
                  tribunais para exercício de direitos em processos judiciais,
                  administrativos ou arbitrais.
                </li>
              </ul>
              <p className="mb-2">
                <strong>6.2.</strong> A Clipfy <strong>não vende</strong> dados
                pessoais a terceiros para fins comerciais.
              </p>
              <p className="mb-6">
                <strong>6.3.</strong> Compartilhamentos públicos: rankings,
                resultados de competições e perfis de Clipadores podem ser
                exibidos publicamente na Plataforma, conforme aceite nos Termos
                de Uso.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 7. Armazenamento */}
            <div id="armazenamento" className="scroll-mt-24">
              <SectionTitle number="7">Armazenamento e Retenção</SectionTitle>
              <p className="mb-2">
                <strong>7.1.</strong> Seus dados são armazenados em servidores
                seguros, localizados no Brasil e/ou em países com nível adequado
                de proteção ou mediante garantias previstas na LGPD (ver seção
                12).
              </p>
              <p className="mb-3">
                <strong>7.2.</strong> Períodos de retenção:
              </p>
              <ul className="mb-4 list-none space-y-2 pl-6">
                <li>
                  <strong>a) Dados de cadastro e participação:</strong> mantidos
                  enquanto a conta estiver ativa e por até 5 anos após
                  encerramento, para cumprimento de obrigações legais, fiscais,
                  contábeis e defesa em processos;
                </li>
                <li>
                  <strong>b) Dados financeiros e de pagamento:</strong> mantidos
                  pelo prazo legal de guarda de documentos fiscais (geralmente 5
                  anos);
                </li>
                <li>
                  <strong>c) Logs de acesso:</strong> mantidos por 6 meses
                  (Marco Civil da Internet) a 2 anos (conformidade com
                  auditorias);
                </li>
                <li>
                  <strong>d) Comunicações e suporte:</strong> mantidas durante o
                  relacionamento e por prazo prescricional aplicável (até 5
                  anos);
                </li>
                <li>
                  <strong>e) Dados para marketing (consentimento):</strong> até
                  revogação do consentimento ou inatividade prolongada (conforme
                  política de retenção).
                </li>
              </ul>
              <p className="mb-6">
                <strong>7.3.</strong> Após o fim do período de retenção, os
                dados serão anonimizados ou eliminados de forma segura, salvo
                obrigação legal de manutenção.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 8. Segurança */}
            <div id="seguranca" className="scroll-mt-24">
              <SectionTitle number="8">Segurança da Informação</SectionTitle>
              <p className="mb-3">
                <strong>8.1.</strong> A Clipfy adota medidas técnicas e
                organizacionais para proteger seus dados contra acessos não
                autorizados, destruição, perda, alteração, divulgação ou
                qualquer forma de tratamento inadequado ou ilícito, incluindo:
              </p>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  Criptografia de dados em trânsito (HTTPS/TLS) e em repouso;
                </li>
                <li>Controles de acesso com autenticação e autorização;</li>
                <li>
                  Monitoramento de segurança, logs de auditoria e detecção de
                  anomalias;
                </li>
                <li>
                  Firewalls, proteção contra DDoS e outras ameaças cibernéticas;
                </li>
                <li>
                  Treinamento de equipe sobre boas práticas de segurança e
                  privacidade;
                </li>
                <li>Testes periódicos de segurança e auditorias internas.</li>
              </ul>
              <p className="mb-2">
                <strong>8.2.</strong> Nenhum sistema é 100% seguro. Embora nos
                esforcemos para proteger seus dados, não podemos garantir
                segurança absoluta.
              </p>
              <p className="mb-6">
                <strong>8.3.</strong> Em caso de incidente de segurança que
                possa gerar risco aos seus direitos, comunicaremos você e a ANPD
                conforme exigido pela LGPD.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 9. Seus Direitos */}
            <div id="direitos" className="scroll-mt-24">
              <SectionTitle number="9">
                Direitos do Titular (Seus Direitos)
              </SectionTitle>
              <p className="mb-3">
                <strong>9.1.</strong> Conforme a LGPD (art. 18), você tem
                direito a:
              </p>

              <div className="mb-6 space-y-3">
                <RightItem icon={Eye}>
                  <strong>Confirmação e acesso:</strong> confirmar se tratamos
                  seus dados e obter cópia deles.
                </RightItem>

                <RightItem icon={FileText}>
                  <strong>Correção:</strong> solicitar correção de dados
                  incompletos, inexatos ou desatualizados.
                </RightItem>

                <RightItem icon={UserMinus}>
                  <strong>Anonimização, bloqueio ou eliminação:</strong>{" "}
                  solicitar anonimização ou eliminação de dados desnecessários,
                  excessivos ou tratados em desconformidade.
                </RightItem>

                <RightItem icon={DownloadSimple}>
                  <strong>Portabilidade:</strong> solicitar a portabilidade dos
                  dados a outro fornecedor (mediante regulamentação da ANPD).
                </RightItem>

                <RightItem icon={Trash}>
                  <strong>
                    Eliminação de dados tratados com consentimento:
                  </strong>{" "}
                  solicitar exclusão quando o tratamento tiver sido baseado em
                  consentimento.
                </RightItem>

                <RightItem icon={ShareNetwork}>
                  <strong>Informação sobre compartilhamento:</strong> saber com
                  quem compartilhamos seus dados.
                </RightItem>

                <RightItem icon={X}>
                  <strong>Revogação do consentimento:</strong> retirar seu
                  consentimento a qualquer momento (quando aplicável).
                </RightItem>

                <RightItem icon={Warning}>
                  <strong>Oposição:</strong> opor-se a tratamentos realizados
                  sem seu consentimento, quando houver descumprimento da LGPD.
                </RightItem>

                <RightItem icon={Scales}>
                  <strong>Revisão de decisões automatizadas:</strong> solicitar
                  revisão de decisões tomadas unicamente com base em tratamento
                  automatizado que afetem seus interesses.
                </RightItem>
              </div>

              <p className="mb-2">
                <strong>9.2.</strong> Para exercer seus direitos, envie
                solicitação para o canal indicado na seção 14, com identificação
                clara e comprovação de identidade.
              </p>
              <p className="mb-2">
                <strong>9.3.</strong> Responderemos à sua solicitação em até 15
                dias, podendo ser prorrogável por mais 15 dias mediante
                justificativa.
              </p>
              <p className="mb-6">
                <strong>9.4.</strong> Algumas solicitações podem ser recusadas
                ou atendidas parcialmente quando houver obrigação legal de
                manutenção dos dados, legítimo interesse preponderante ou
                necessidade para defesa de direitos da Clipfy.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 10. Cookies */}
            <div id="cookies" className="scroll-mt-24">
              <SectionTitle number="10">
                Cookies e Tecnologias Semelhantes
              </SectionTitle>
              <p className="mb-3">
                <strong>10.1.</strong> A Plataforma utiliza cookies, web
                beacons, pixels e tecnologias similares para:
              </p>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>Manter sua sessão ativa (cookies essenciais);</li>
                <li>Lembrar preferências e configurações;</li>
                <li>Coletar estatísticas de uso e desempenho (analytics);</li>
                <li>
                  Oferecer conteúdo personalizado e melhorar a experiência;
                </li>
                <li>Realizar análises de segurança e antifraude.</li>
              </ul>
              <p className="mb-3">
                <strong>10.2.</strong> Categorias de cookies:
              </p>
              <ul className="mb-4 list-none space-y-2 pl-6">
                <li>
                  <strong>a) Essenciais:</strong> necessários para o
                  funcionamento da Plataforma (não requerem consentimento);
                </li>
                <li>
                  <strong>b) Funcionais:</strong> melhoram a experiência (ex.:
                  lembrar idioma, tema);
                </li>
                <li>
                  <strong>c) Analytics/desempenho:</strong> coletam dados
                  agregados sobre uso da Plataforma;
                </li>
                <li>
                  <strong>d) Marketing:</strong> podem ser usados para
                  publicidade direcionada (quando aplicável, com consentimento).
                </li>
              </ul>
              <p className="mb-2">
                <strong>10.3.</strong> Você pode gerenciar cookies nas
                configurações do navegador, mas isso pode afetar funcionalidades
                da Plataforma.
              </p>
              <p className="mb-6">
                <strong>10.4.</strong> Para mais detalhes, consulte nossa
                Política de Cookies (Anexo A).
              </p>
            </div>

            <Separator className="my-8" />

            {/* 11. Menores de Idade */}
            <div id="menores" className="scroll-mt-24">
              <SectionTitle number="11">Menores de Idade</SectionTitle>
              <p className="mb-2">
                <strong>11.1.</strong> A Clipfy League é destinada
                exclusivamente a maiores de 18 anos.
              </p>
              <p className="mb-2">
                <strong>11.2.</strong> Não coletamos intencionalmente dados de
                menores de idade. Caso identifiquemos cadastro de menor, a conta
                será imediatamente suspensa e os dados eliminados.
              </p>
              <p className="mb-6">
                <strong>11.3.</strong> Pais, responsáveis ou menores que
                identifiquem cadastro indevido devem nos contatar imediatamente
                para providências.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 12. Transferência Internacional */}
            <div id="transferencia" className="scroll-mt-24">
              <SectionTitle number="12">
                Transferência Internacional de Dados
              </SectionTitle>
              <p className="mb-2">
                <strong>12.1.</strong> Alguns de nossos prestadores de serviço
                (ex.: provedores de infraestrutura em nuvem, ferramentas de
                analytics) podem estar localizados fora do Brasil.
              </p>
              <p className="mb-2">
                <strong>12.2.</strong> Nesses casos, asseguramos a transferência
                internacional por meio de:
              </p>
              <ul className="mb-4 list-disc space-y-1 pl-6">
                <li>
                  Países com nível adequado de proteção reconhecido pela ANPD;
                </li>
                <li>
                  Cláusulas contratuais padrão (Standard Contractual Clauses);
                </li>
                <li>Certificações internacionais de proteção de dados;</li>
                <li>Consentimento específico quando necessário.</li>
              </ul>
              <p className="mb-6">
                <strong>12.3.</strong> A Clipfy garante que os dados
                transferidos recebam nível de proteção adequado, conforme
                exigido pela LGPD.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 13. Alterações */}
            <div id="alteracoes" className="scroll-mt-24">
              <SectionTitle number="13">Alterações nesta Política</SectionTitle>
              <p className="mb-2">
                <strong>13.1.</strong> Esta Política pode ser atualizada
                periodicamente para refletir mudanças em nossas práticas,
                legislação ou funcionalidades da Plataforma.
              </p>
              <p className="mb-2">
                <strong>13.2.</strong> Alterações substanciais serão comunicadas
                por e-mail, notificação in-app ou aviso destacado na Plataforma,
                com antecedência razoável.
              </p>
              <p className="mb-6">
                <strong>13.3.</strong> A versão atualizada entrará em vigor na
                data indicada. O uso contínuo da Plataforma após a publicação
                significará aceite das alterações.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 14. Contato/DPO */}
            <div id="contato" className="scroll-mt-24">
              <SectionTitle number="14">
                Contato e Encarregado de Dados (DPO)
              </SectionTitle>
              <p className="mb-3">
                <strong>14.1.</strong> Para questões sobre esta Política,
                exercício de direitos (LGPD), reclamações ou dúvidas sobre
                proteção de dados:
              </p>
              <div className="border-brand-cyan/20 bg-brand-cyan/5 mb-4 rounded-2xl border p-4">
                <p className="mb-2">
                  <strong>Encarregado de Proteção de Dados (DPO)</strong>
                </p>
                <p className="mb-1">
                  E-mail:{" "}
                  <a
                    href="mailto:legal@clipfyai.com"
                    className="text-brand-cyan hover:underline"
                  >
                    legal@clipfyai.com
                  </a>
                </p>
                <p className="mb-1">
                  Assunto: &quot;LGPD – [Natureza da Solicitação]&quot;
                </p>
              </div>
              <p className="mb-2">
                <strong>14.2.</strong> Para suporte técnico geral:{" "}
                <a
                  href="mailto:support@clipfyai.com"
                  className="text-brand-cyan hover:underline"
                >
                  support@clipfyai.com
                </a>
              </p>
              <p className="mb-6">
                <strong>14.3.</strong> Você também pode registrar reclamações
                diretamente na Autoridade Nacional de Proteção de Dados (ANPD):{" "}
                <a
                  href="https://www.gov.br/anpd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-cyan hover:underline"
                >
                  www.gov.br/anpd
                </a>
              </p>
            </div>
          </div>

          {/* ===== Anexos ===== */}
          <div id="anexos" className="mb-12 scroll-mt-24 space-y-6">
            {/* Anexo A */}
            <div className="glass-card ring-brand-cyan/30 rounded-3xl p-6 ring-1">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <Cookie
                  className="text-brand-cyan size-6 shrink-0"
                  weight="fill"
                />
                ANEXO A — Política de Cookies
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-2 font-semibold">O que são cookies?</p>
                  <p className="text-muted-foreground">
                    Cookies são pequenos arquivos de texto armazenados no seu
                    dispositivo quando você acessa a Plataforma. Eles nos ajudam
                    a reconhecer você, lembrar suas preferências e melhorar sua
                    experiência.
                  </p>
                </div>

                <div>
                  <p className="mb-2 font-semibold">
                    Tipos de cookies utilizados:
                  </p>
                  <ul className="text-muted-foreground space-y-2">
                    <li>
                      <strong>• Cookies essenciais:</strong> necessários para
                      login, navegação e funcionalidades básicas (não requerem
                      consentimento).
                    </li>
                    <li>
                      <strong>• Cookies de preferências:</strong> armazenam
                      configurações como tema (claro/escuro), idioma.
                    </li>
                    <li>
                      <strong>• Cookies de analytics:</strong> coletam dados
                      anônimos sobre uso da Plataforma (Google Analytics ou
                      similar).
                    </li>
                    <li>
                      <strong>• Cookies de segurança:</strong> detectam
                      atividades suspeitas e protegem contra fraudes.
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="mb-2 font-semibold">Como gerenciar cookies:</p>
                  <p className="text-muted-foreground">
                    Você pode configurar seu navegador para bloquear ou alertar
                    sobre cookies. Acesse as configurações do seu navegador
                    (Chrome, Firefox, Safari, Edge) para gerenciar cookies. Note
                    que bloquear cookies essenciais pode impedir o funcionamento
                    adequado da Plataforma.
                  </p>
                </div>

                <div>
                  <p className="mb-2 font-semibold">Cookies de terceiros:</p>
                  <p className="text-muted-foreground">
                    Podemos utilizar serviços de terceiros (ex.: Google
                    Analytics) que definem seus próprios cookies. Consulte as
                    políticas de privacidade desses serviços para mais
                    informações.
                  </p>
                </div>
              </div>
            </div>

            {/* Anexo B */}
            <div className="glass-card rounded-3xl p-6 ring-1 ring-emerald-500/30">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <CheckCircle
                  className="size-6 shrink-0 text-emerald-400"
                  weight="fill"
                />
                ANEXO B — Boas Práticas de Segurança para o Usuário
              </h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Proteja seus dados seguindo estas recomendações:
              </p>
              <div className="space-y-2">
                {[
                  "Use uma senha forte, única e diferente de outras contas.",
                  "Nunca compartilhe sua senha com terceiros.",
                  "Ative autenticação de dois fatores (2FA) quando disponível.",
                  "Faça logout ao usar dispositivos compartilhados ou públicos.",
                  "Mantenha seu e-mail de cadastro seguro e atualizado.",
                  "Desconfie de e-mails suspeitos pedindo credenciais (phishing).",
                  "Mantenha seu navegador e sistema operacional atualizados.",
                  "Notifique imediatamente qualquer atividade suspeita na sua conta.",
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

            {/* Anexo C */}
            <div className="glass-card rounded-3xl p-6 ring-1 ring-sky-500/30">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <Database
                  className="size-6 shrink-0 text-sky-400"
                  weight="fill"
                />
                ANEXO C — Resumo dos seus Direitos (LGPD)
              </h3>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground mb-3">
                  Conforme a Lei Geral de Proteção de Dados (LGPD), você tem os
                  seguintes direitos:
                </p>

                <div className="grid gap-3">
                  <div className="flex items-start gap-2">
                    <span className="min-w-[140px] font-semibold">Acesso</span>
                    <span className="text-muted-foreground">
                      Saber quais dados temos sobre você
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="min-w-[140px] font-semibold">
                      Correção
                    </span>
                    <span className="text-muted-foreground">
                      Corrigir dados incorretos ou desatualizados
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="min-w-[140px] font-semibold">
                      Eliminação
                    </span>
                    <span className="text-muted-foreground">
                      Solicitar exclusão de dados desnecessários
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="min-w-[140px] font-semibold">
                      Portabilidade
                    </span>
                    <span className="text-muted-foreground">
                      Transferir seus dados para outro serviço
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="min-w-[140px] font-semibold">
                      Revogação
                    </span>
                    <span className="text-muted-foreground">
                      Retirar consentimento a qualquer momento
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="min-w-[140px] font-semibold">
                      Informação
                    </span>
                    <span className="text-muted-foreground">
                      Saber com quem compartilhamos seus dados
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="min-w-[140px] font-semibold">
                      Oposição
                    </span>
                    <span className="text-muted-foreground">
                      Se opor a tratamentos irregulares
                    </span>
                  </div>
                </div>

                <div className="border-border/60 mt-4 border-t pt-4">
                  <p className="mb-1 font-semibold">
                    Como exercer seus direitos:
                  </p>
                  <p className="text-muted-foreground">
                    Envie um e-mail para{" "}
                    <a
                      href="mailto:legal@clipfyai.com"
                      className="text-brand-cyan hover:underline"
                    >
                      legal@clipfyai.com
                    </a>{" "}
                    com o assunto &quot;LGPD – [Seu Direito]&quot; e um
                    documento que comprove sua identidade.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-muted-foreground space-y-2 pb-4 text-center text-sm">
            <p>
              Esta Política de Privacidade está em conformidade com a Lei nº
              13.709/2018 (LGPD).
            </p>
            <p>
              © 2026 Clipfy Softwares Tecnologia LTDA. Todos os direitos
              reservados.
            </p>
            <p className="pt-2">
              <Link
                href="/terms-of-use"
                className="text-brand-cyan hover:underline"
              >
                Termos de Uso
              </Link>
            </p>
          </div>
        </div>
      </div>
    </DarkScope>
  )
}
