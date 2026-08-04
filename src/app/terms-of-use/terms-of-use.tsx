"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChatCircleText,
  CheckCircle,
  Copyright,
  CurrencyDollar,
  Database,
  FileText,
  Gavel,
  Gear,
  Globe,
  List,
  Lock,
  Medal,
  Prohibit,
  Scales,
  Shield,
  UsersThree,
  Warning,
  WarningCircle,
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
  { id: "objeto", title: "1. Objeto e Escopo", icon: FileText },
  { id: "elegibilidade", title: "2. Elegibilidade", icon: UsersThree },
  { id: "declaracoes", title: "3. Declarações", icon: Shield },
  { id: "cadastro", title: "4. Cadastro", icon: Lock },
  { id: "competicoes", title: "5. Competições", icon: Medal },
  { id: "antifraude", title: "6. Antifraude", icon: Warning },
  { id: "sancoes", title: "7. Sanções", icon: Prohibit },
  { id: "propriedade", title: "8. Propriedade Intelectual", icon: Copyright },
  { id: "plataformas", title: "9. Plataformas Terceiros", icon: Globe },
  { id: "privacidade", title: "10. Privacidade (LGPD)", icon: Database },
  { id: "premiacao", title: "11. Premiações", icon: CurrencyDollar },
  { id: "comunidade", title: "12. Comunidade", icon: ChatCircleText },
  { id: "suporte", title: "13. Suporte", icon: Gear },
  { id: "responsabilidades", title: "14. Responsabilidades", icon: Shield },
  { id: "encerramento", title: "15. Encerramento", icon: WarningCircle },
  { id: "denuncias", title: "16. Denúncias", icon: Warning },
  { id: "disposicoes", title: "17. Disposições", icon: Scales },
  { id: "lei", title: "18. Lei e Foro", icon: Gavel },
  { id: "aceite", title: "19. Aceite", icon: CheckCircle },
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

/** Título de seção dos termos. */
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

export default function TermsOfUse() {
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
              <FileText className="size-8 text-[#04222A]" weight="fill" />
            </div>
            <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Termos de Uso do <span className="text-gradient">Clipador</span>
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
                <h3 className="mb-2 text-lg font-semibold">Aviso Importante</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Ao se cadastrar, acessar ou usar a Clipfy League, você
                  (&quot;Clipador&quot;, &quot;Usuário&quot; ou &quot;você&quot;)
                  declara ter lido, entendido e aceito integralmente estes
                  Termos de Uso e a Política de Privacidade da Clipfy. Se você
                  não concordar, não utilize a Plataforma.
                </p>
              </div>
            </div>
          </div>

          {/* Controladora */}
          <div className="glass-card mb-8 rounded-3xl p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className="bg-brand-cyan/15 flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Shield className="text-brand-cyan size-5" weight="fill" />
              </span>
              <div className="min-w-0 space-y-2">
                <h3 className="text-lg font-semibold">
                  Controladora/Operadora da Plataforma
                </h3>
                <p className="text-muted-foreground text-sm">
                  <strong className="text-foreground">
                    CLIPFY SOFTWARES TECNOLOGIA LTDA
                  </strong>
                  <br />
                  CNPJ nº 59.769.545/0001-00
                  <br />
                  Rua Noronha Torrezão, nº 24, sala 1009, Santa Rosa
                  <br />
                  Niterói/RJ – CEP 24240-182
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo dos Termos */}
          <div className="glass-card mb-8 rounded-3xl p-5 leading-relaxed sm:p-8 lg:p-10">
            {/* 1. Objeto e Escopo */}
            <div id="objeto" className="scroll-mt-24">
              <SectionTitle number="1">Objeto e Escopo</SectionTitle>
              <p className="mb-3">
                <strong>1.1.</strong> Estes Termos regulam (i) o cadastro e
                participação do Clipador em competições de edição de vídeo
                (&quot;Competições&quot;); (ii) o envio/registro de posts nas
                plataformas de terceiros (Instagram, TikTok e YouTube, entre
                outras suportadas); (iii) a moderação, pontuação e premiações
                quando aplicável; e (iv) regras de conformidade, antifraude e
                propriedade intelectual.
              </p>
              <p className="mb-6">
                <strong>1.2.</strong> A Clipfy League não é plataforma de
                publicação nem marketplace de mídias sociais. O foco é
                competição de edição. O envio de links é apenas para comprovação
                de performance e autoria conforme estes Termos.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 2. Elegibilidade */}
            <div id="elegibilidade" className="scroll-mt-24">
              <SectionTitle number="2">Elegibilidade e Conta</SectionTitle>
              <p className="mb-2">
                <strong>2.1.</strong> Idade mínima: 18 anos completos. Menores
                são proibidos.
              </p>
              <p className="mb-2">
                <strong>2.2.</strong> Capacidade: Você declara possuir
                capacidade civil para contratar e assumir obrigações.
              </p>
              <p className="mb-2">
                <strong>2.3.</strong> Conta pessoal e intransferível: Cada
                usuário deve manter uma única conta. É vedado compartilhar
                credenciais, ceder, vender ou alugar a conta.
              </p>
              <p className="mb-6">
                <strong>2.4.</strong> Verificação: Poderemos solicitar dados,
                documentos, provas de titularidade das contas de redes sociais e
                outras validações (ex.: vídeo de verificação, prints, e-mails de
                confirmação, tela do estúdio de criação). A ausência, recusa ou
                inconsistência pode levar a suspensão ou exclusão.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 3. Declarações */}
            <div id="declaracoes" className="scroll-mt-24">
              <SectionTitle number="3">Declarações do Clipador</SectionTitle>
              <p className="mb-3">
                Ao usar a Plataforma, você declara e garante que:
              </p>
              <ul className="mb-6 list-disc space-y-2 pl-6">
                <li>
                  Todos os dados fornecidos são verdadeiros, completos e
                  atualizados;
                </li>
                <li>
                  Os posts cadastrados na Plataforma:
                  <ul className="mt-2 list-[circle] space-y-1 pl-6">
                    <li>Foram editados por você (autoria da edição);</li>
                    <li>
                      São oriundos de contas de sua titularidade ou contas para
                      as quais você detém autorização expressa e verificável do
                      titular;
                    </li>
                    <li>
                      Não violam direitos de terceiros (direito autoral, marcas,
                      imagem, voz, nome, privacidade, dados pessoais etc.);
                    </li>
                    <li>
                      Respeitam os Termos e Políticas das plataformas de
                      terceiros (Instagram, TikTok, YouTube etc.);
                    </li>
                  </ul>
                </li>
                <li>
                  Você não utilizará quaisquer meios para fraudar métricas
                  (views, likes, comentários, watch time, CTR, retenção,
                  compartilhamentos etc.), incluindo, sem limitação:
                  compra/geração artificial de engajamento, bots, farms de
                  views, redes de engajamento forçado, automações proibidas,
                  VPNs/Proxies para manipulação de geolocalização quando vedado
                  pelas plataformas, ou qualquer outro artifício que distorça a
                  performance real;
                </li>
                <li>
                  Você cumprirá a legislação aplicável, inclusive Lei
                  12.965/2014 (Marco Civil da Internet), LGPD – Lei 13.709/2018,
                  Lei de Direitos Autorais – Lei 9.610/1998, Código Civil, CDC
                  (quando aplicável), e normas setoriais.
                </li>
              </ul>
            </div>

            <Separator className="my-8" />

            {/* 4. Cadastro */}
            <div id="cadastro" className="scroll-mt-24">
              <SectionTitle number="4">
                Cadastro, Segurança e Suporte
              </SectionTitle>
              <p className="mb-2">
                <strong>4.1.</strong> Confidencialidade de credenciais: Mantenha
                login/senha sob sigilo e use autenticação adicional quando
                disponível.
              </p>
              <p className="mb-2">
                <strong>4.2.</strong> Notifique imediatamente caso suspeite de
                uso indevido da conta.
              </p>
              <p className="mb-6">
                <strong>4.3.</strong> Suporte: Canais de contato e prazos de
                resposta constam na Plataforma. Podem variar por volume de
                atendimento.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 5. Competições */}
            <div id="competicoes" className="scroll-mt-24">
              <SectionTitle number="5">Regras das Competições</SectionTitle>
              <p className="mb-3">
                <strong>5.1.</strong> Cada Competição pode ter regulamento
                próprio (tema, prazo, elegibilidade, critérios de pontuação e
                desempate, formato de entrega, premiação etc.). Em caso de
                conflito, prevalece o regulamento específico daquela Competição,
                complementado por estes Termos.
              </p>
              <p className="mb-2">
                <strong>5.2.</strong> Envio de posts:
              </p>
              <ul className="mb-3 list-none space-y-2 pl-6">
                <li>
                  <strong>I.</strong> O Clipador deve registrar os links dos
                  vídeos postados externamente (p. ex., URL pública no
                  Instagram/TikTok/YouTube).
                </li>
                <li>
                  <strong>II.</strong> Apenas posts das suas próprias contas ou
                  expressamente autorizadas pelo titular.
                </li>
                <li>
                  <strong>III.</strong> Não há limite de quantidade de posts,
                  salvo previsão específica do regulamento; entretanto,
                  conteúdos repetidos ou re-postagens idênticas do mesmo corte
                  poderão ser reprovados e, a depender da reincidência, gerar
                  eliminação.
                </li>
              </ul>
              <p className="mb-2">
                <strong>5.3.</strong> Integridade da pontuação:
              </p>
              <ul className="mb-3 list-none space-y-2 pl-6">
                <li>
                  <strong>I.</strong> As métricas podem considerar qualidade e
                  quantidade (exemplos: retenção, clareza de edição,
                  criatividade, adequação ao briefing, número de entregas
                  válidas).
                </li>
                <li>
                  <strong>II.</strong> Métricas exibidas são indicativas e podem
                  passar por validação e auditoria antes de homologação.
                </li>
                <li>
                  <strong>III.</strong> A Clipfy poderá desconsiderar
                  posts/métricas suspeitos ou com sinais de comportamento
                  anômalo.
                </li>
              </ul>
              <p className="mb-6">
                <strong>5.4.</strong> Provas e auditoria: Podemos solicitar
                comprovantes (telas de analytics nativas, histórico do editor,
                arquivos de projeto, fontes utilizadas, autorização do titular
                da conta). O não envio ou envio insatisfatório pode resultar em
                desclassificação e sanções.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 6. Antifraude */}
            <div id="antifraude" className="scroll-mt-24">
              <SectionTitle number="6">
                Política Antifraude e Condutas Proibidas
              </SectionTitle>
              <p className="mb-3">
                <strong>6.1.</strong> É expressamente proibido:
              </p>
              <ul className="mb-4 list-none space-y-2 pl-6">
                <li>
                  <strong>a)</strong> Fraudar dados ou métricas (views, likes,
                  comentários, watch time etc.);
                </li>
                <li>
                  <strong>b)</strong> Enviar links de posts que não sejam da sua
                  conta (ou sem autorização do titular);
                </li>
                <li>
                  <strong>c)</strong> Usar automações e scripts proibidos pelas
                  plataformas de terceiros;
                </li>
                <li>
                  <strong>d)</strong> Repostar o mesmo conteúdo repetidamente
                  para inflar volume;
                </li>
                <li>
                  <strong>e)</strong> Mascarar IP/geo para manipular alcance
                  quando vedado;
                </li>
                <li>
                  <strong>f)</strong> Violar direitos autorais (música, trechos
                  de vídeos, imagens, marcas) sem licenças e créditos exigidos;
                </li>
                <li>
                  <strong>g)</strong> Desrespeito na comunicação (assédio,
                  discriminação, discurso de ódio, ameaças, divulgação de dados
                  sensíveis);
                </li>
                <li>
                  <strong>h)</strong> Conteúdo impróprio/ilegal, incluindo nudez
                  explícita, exploração infantil, apologia a crime,
                  desinformação deliberada;
                </li>
                <li>
                  <strong>i)</strong> Venda de produtos/serviços não autorizados
                  dentro da Plataforma;
                </li>
                <li>
                  <strong>j)</strong> Engenharia reversa, scraping ou uso
                  indevido das APIs/serviços da Clipfy;
                </li>
                <li>
                  <strong>k)</strong> Burlar, testar ou comprometer a segurança
                  da Plataforma.
                </li>
              </ul>
              <p className="mb-6">
                <strong>6.2.</strong> Sinais de fraude (exemplos) podem incluir:
                picos antinaturais, correlação com redes de engajamento pago,
                inconsistências de audiência, uso de contas recém-criadas sem
                lastro real, divergências entre analíticos oficiais e dados
                apresentados pelo Clipador.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 7. Sanções */}
            <div id="sancoes" className="scroll-mt-24">
              <SectionTitle number="7">
                Sanções, Moderação e Apelações
              </SectionTitle>
              <p className="mb-2">
                <strong>7.1.</strong> A Clipfy poderá, a seu exclusivo critério,
                aplicar: advertência, remoção de posts, anulação de métricas,
                perda de pontos/premiação, suspensão temporária, banimento da
                Plataforma e/ou comunicação às autoridades quando aplicável.
              </p>
              <p className="mb-2">
                <strong>7.2.</strong> Em caso de suspeita de fraude, a Clipfy
                pode reter a premiação até conclusão da análise.
              </p>
              <p className="mb-6">
                <strong>7.3.</strong> Canal de apelação: Você poderá apresentar
                recurso no prazo informado na notificação. A decisão final da
                Clipfy será soberana no âmbito da Plataforma.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 8. Propriedade Intelectual */}
            <div id="propriedade" className="scroll-mt-24">
              <SectionTitle number="8">
                Propriedade Intelectual e Licenças
              </SectionTitle>
              <p className="mb-2">
                <strong>8.1.</strong> Sua titularidade: A edição que você
                produzir permanece sua, ressalvados direitos de terceiros sobre
                o conteúdo de origem (ex.: vídeo-fonte do influenciador/marca).
              </p>
              <p className="mb-2">
                <strong>8.2.</strong> Responsabilidade por direitos: Você é
                integralmente responsável por obter e manter as autorizações
                necessárias (direito autoral, imagem/voz de pessoas retratadas,
                marcas, músicas) do conteúdo que editar e postar.
              </p>
              <p className="mb-2">
                <strong>8.3.</strong> Licença à Clipfy: Ao enviar/registrar
                conteúdos na Plataforma, você concede à Clipfy uma licença não
                exclusiva, gratuita, mundial e por prazo indeterminado para
                armazenar, exibir, reproduzir trechos, catalogar, divulgar
                resultados e promover a Plataforma/Competições (incluindo
                portfólios, landing pages, cases e materiais de marketing),
                sempre com menção ao seu perfil quando cabível. Você pode
                revogar a licença para fins promocionais mediante solicitação
                escrita, sem efeitos retroativos e ressalvadas obrigações
                legais.
              </p>
              <p className="mb-6">
                <strong>8.4.</strong> Marcas Clipfy: O uso de marcas, logotipos,
                nomes comerciais da Clipfy requer autorização prévia e escrita.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 9. Plataformas Terceiros */}
            <div id="plataformas" className="scroll-mt-24">
              <SectionTitle number="9">
                Relação com Plataformas de Terceiros
              </SectionTitle>
              <p className="mb-2">
                <strong>9.1.</strong> Instagram, TikTok, YouTube e demais
                plataformas são independentes da Clipfy. O uso está sujeito aos
                termos e políticas dessas plataformas.
              </p>
              <p className="mb-2">
                <strong>9.2.</strong> A Clipfy não se responsabiliza por
                mudanças nas APIs, indisponibilidades, banimentos, limitações de
                conta, strikes ou bloqueios aplicados por tais plataformas.
              </p>
              <p className="mb-6">
                <strong>9.3.</strong> Você declara estar em conformidade com as
                regras de cada plataforma ao postar e ao nos fornecer
                links/métricas.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 10. Privacidade (LGPD) */}
            <div id="privacidade" className="scroll-mt-24">
              <SectionTitle number="10">
                Privacidade e Proteção de Dados (LGPD)
              </SectionTitle>
              <p className="mb-2">
                <strong>10.1.</strong> A Clipfy trata dados pessoais para
                execução do contrato (prestação do serviço), legítimo interesse
                (segurança antifraude, melhoria da Plataforma, métricas e
                auditoria) e, quando necessário, consentimento (comunicações de
                marketing, cookies não essenciais).
              </p>
              <p className="mb-2">
                <strong>10.2.</strong> Dados coletados podem incluir:
                identificação, contato, dados de conta da Plataforma, perfis de
                redes sociais vinculados, logs de acesso (IP, data/hora,
                device), links e métricas de posts, histórico de participação,
                evidências de autoria/titularidade, dados de pagamento/premiação
                quando houver.
              </p>
              <p className="mb-2">
                <strong>10.3.</strong> Direitos do titular (LGPD): confirmação,
                acesso, correção, anonimização, portabilidade, eliminação nos
                termos legais, informação sobre compartilhamento e revogação de
                consentimento quando aplicável.
              </p>
              <p className="mb-2">
                <strong>10.4.</strong> Segurança: Adotamos medidas técnicas e
                organizacionais proporcionais ao risco. Nenhum sistema é 100%
                seguro.
              </p>
              <p className="mb-2">
                <strong>10.5.</strong> Compartilhamento: Podemos compartilhar
                dados com provedores de infraestrutura, antifraude, auditoria,
                parceiros de premiação e cumprimento legal.
              </p>
              <p className="mb-6">
                <strong>10.6.</strong> Política de Privacidade: Detalhes
                adicionais constam em documento específico, parte integrante
                destes Termos.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 11. Premiações */}
            <div id="premiacao" className="scroll-mt-24">
              <SectionTitle number="11">
                Premiações, Pagamentos e Tributos
              </SectionTitle>
              <p className="mb-2">
                <strong>11.1.</strong> Competições podem prever premiações
                (financeiras, produtos, serviços, licenças), conforme
                regulamento.
              </p>
              <p className="mb-2">
                <strong>11.2.</strong> A Clipfy poderá exigir documentação
                (identidade, comprovação bancária, nota fiscal quando aplicável)
                antes do pagamento/entrega.
              </p>
              <p className="mb-2">
                <strong>11.3.</strong> Tributação: O Clipador é responsável por
                impostos, contribuições e obrigações fiscais incidentes sobre
                valores recebidos.
              </p>
              <p className="mb-6">
                <strong>11.4.</strong> Estornos e retenções: Se houver fraude ou
                infração, a Clipfy pode reter, cancelar ou reaver premiações
                pagas indevidamente, sem prejuízo de medidas legais.
              </p>
              <p className="mb-6">
                <strong>11.5.</strong> Caso a Clipfy decida encerrar uma
                Competição de forma antecipada, serão pagos os valores devidos
                das premiações diárias já homologadas, juntamente com a parcela
                proporcional da premiação mensal (ou equivalente ao período
                efetivamente realizado), seguindo os critérios da Competição.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 12. Comunidade */}
            <div id="comunidade" className="scroll-mt-24">
              <SectionTitle number="12">Comunidade e Comunicação</SectionTitle>
              <p className="mb-2">
                <strong>12.1.</strong> É obrigatório manter respeito e
                urbanidade em todos os canais (inclusive Discord, fóruns e
                suporte).
              </p>
              <p className="mb-2">
                <strong>12.2.</strong> É vedado assediar, difamar, discriminar
                ou ameaçar outros usuários, staff, marcas ou terceiros.
              </p>
              <p className="mb-6">
                <strong>12.3.</strong> A Clipfy pode emitir avisos oficiais via
                e-mail, notificações in-app, publicações na Plataforma ou canais
                oficiais.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 13. Suporte */}
            <div id="suporte" className="scroll-mt-24">
              <SectionTitle number="13">
                Suporte Técnico, Disponibilidade e Alterações
              </SectionTitle>
              <p className="mb-2">
                <strong>13.1.</strong> A Plataforma é fornecida em regime
                &quot;como está&quot; (&quot;as is&quot;) e &quot;conforme
                disponibilidade&quot; (&quot;as available&quot;).
              </p>
              <p className="mb-2">
                <strong>13.2.</strong> Podemos realizar manutenções programadas
                ou emergenciais, inclusive com indisponibilidade temporária.
              </p>
              <p className="mb-2">
                <strong>13.3.</strong> Evoluções/alterações de funcionalidades
                podem ocorrer a qualquer tempo, sem obrigação de manter recursos
                legados.
              </p>
              <p className="mb-6">
                <strong>13.4.</strong> Atualizações dos Termos: Poderemos
                alterar estes Termos. As mudanças entrarão em vigor após
                publicação; o uso contínuo significará aceite.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 14. Responsabilidades */}
            <div id="responsabilidades" className="scroll-mt-24">
              <SectionTitle number="14">
                Responsabilidades e Limitações
              </SectionTitle>
              <p className="mb-2">
                <strong>14.1.</strong> Responsabilidade do Clipador: Você
                responde por todo conteúdo enviado/registrado, por suas ações
                nas redes sociais e pelo cumprimento das leis e termos de
                terceiros.
              </p>
              <p className="mb-2">
                <strong>14.2.</strong> Indenização: Você concorda em indenizar a
                Clipfy, seus sócios e colaboradores por reclamações, perdas,
                danos, custos e honorários decorrentes de (i) violação destes
                Termos; (ii) infração a direitos de terceiros; (iii) fraude ou
                prática ilícita.
              </p>
              <p className="mb-2">
                <strong>14.3.</strong> Limitação de responsabilidade: Na máxima
                medida permitida, a Clipfy não responde por lucros cessantes,
                perdas de receita, perda de dados, danos indiretos, especiais,
                punitivos, incidentais ou consequenciais. A responsabilidade
                total da Clipfy, se existente, ficará limitada ao maior entre:
                (i) R$ 1.000,00 (mil reais) ou (ii) o total por você
                eventualmente pago à Clipfy nos últimos 3 meses anteriores ao
                evento.
              </p>
              <p className="mb-6">
                <strong>14.4.</strong> Força maior: A Clipfy não se
                responsabiliza por eventos fora de seu controle (ex.: quedas de
                serviços de terceiros, atos governamentais, desastres, ataques,
                greves).
              </p>
            </div>

            <Separator className="my-8" />

            {/* 15. Encerramento */}
            <div id="encerramento" className="scroll-mt-24">
              <SectionTitle number="15">Encerramento e Suspensão</SectionTitle>
              <p className="mb-2">
                <strong>15.1.</strong> Você pode encerrar sua conta a qualquer
                momento, observadas obrigações pendentes (ex.: apurações de
                Competição, suspeita de fraude, entrega de prêmios).
              </p>
              <p className="mb-2">
                <strong>15.2.</strong> A Clipfy pode suspender ou encerrar
                contas em casos de violação destes Termos, suspeita de fraude,
                ordem legal ou risco à segurança.
              </p>
              <p className="mb-6">
                <strong>15.3.</strong> A exclusão/encerramento não impede a
                conservação de dados pelo período legal e para defesa da Clipfy
                em processos administrativos/judiciais.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 16. Denúncias */}
            <div id="denuncias" className="scroll-mt-24">
              <SectionTitle number="16">
                Canal de Denúncias e DMCA/Notificação de Violação
              </SectionTitle>
              <p className="mb-2">
                <strong>16.1.</strong> Denuncie conteúdos ou condutas que violem
                estes Termos por meio dos canais indicados na Plataforma.
              </p>
              <p className="mb-6">
                <strong>16.2.</strong> Para reclamações de direitos autorais
                (DMCA/Lei 9.610/98), envie notificação formal contendo:
                identificação do material, comprovação de titularidade, dados de
                contato e declaração de veracidade. A Clipfy poderá remover
                preventivamente o conteúdo e notificar a outra parte para
                contranotificação.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 17. Disposições */}
            <div id="disposicoes" className="scroll-mt-24">
              <SectionTitle number="17">Disposições Diversas</SectionTitle>
              <p className="mb-2">
                <strong>17.1.</strong> Independência das cláusulas: A nulidade
                de uma cláusula não invalida as demais.
              </p>
              <p className="mb-2">
                <strong>17.2.</strong> Cessão: A Clipfy pode ceder suas posições
                contratuais em operações societárias. Você não pode ceder sem
                anuência escrita.
              </p>
              <p className="mb-2">
                <strong>17.3.</strong> Ausência de parceria: Nada aqui cria
                sociedade, joint venture, vínculo trabalhista ou representação
                entre as partes.
              </p>
              <p className="mb-6">
                <strong>17.4.</strong> Provas eletrônicas: Logs, registros e
                comunicações eletrônicas poderão ser utilizados como prova.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 18. Lei e Foro */}
            <div id="lei" className="scroll-mt-24">
              <SectionTitle number="18">Lei Aplicável e Foro</SectionTitle>
              <p className="mb-2">
                <strong>18.1.</strong> Aplica-se a lei brasileira.
              </p>
              <p className="mb-6">
                <strong>18.2.</strong> Fica eleito o Foro da Comarca de
                Niterói/RJ, com renúncia de qualquer outro, por mais
                privilegiado que seja.
              </p>
            </div>

            <Separator className="my-8" />

            {/* 19. Aceite */}
            <div id="aceite" className="scroll-mt-24">
              <SectionTitle number="19">Aceite Eletrônico</SectionTitle>
              <p className="mb-6">
                <strong>19.1.</strong> O clique em &quot;Li e aceito&quot;, o
                uso da conta ou a participação em Competições configuram aceite
                integral destes Termos e da Política de Privacidade.
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
                ANEXO A — Diretrizes de Conteúdo e Integridade
              </h3>
              <div className="space-y-3 text-sm">
                <p>
                  <strong>Conteúdo permitido:</strong> cortes/edições inéditas;
                  respeito a direitos de terceiros; atender ao briefing/tema
                  quando existir.
                </p>
                <p>
                  <strong>Conteúdo proibido:</strong> ilegal, perigoso, sexual
                  explícito, ódio, assédio, dados sensíveis de terceiros,
                  desinformação deliberada, violação de direitos
                  autorais/marca/imagem, promoção de produtos/serviços não
                  autorizados.
                </p>
                <p>
                  <strong>Autoria e titularidade:</strong> poste apenas de
                  contas suas ou com autorização verificável.
                </p>
                <p>
                  <strong>Repetição:</strong> links/edições repetidos podem ser
                  reprovados; reincidência leva à eliminação.
                </p>
                <p>
                  <strong>Métricas:</strong> qualquer indício de manipulação
                  (bots, compra de views/likes/comentários, pods, retenção
                  artificial) implica anulação de pontos e sanções.
                </p>
                <p>
                  <strong>Auditoria:</strong> guarde provas (projeto de edição,
                  fontes/músicas, prints de analytics, autorização do titular da
                  conta).
                </p>
                <p>
                  <strong>Comunidade:</strong> respeito absoluto na comunicação
                  (sem ataques, xingamentos, preconceito).
                </p>
              </div>
            </div>

            {/* Anexo B */}
            <div className="glass-card rounded-3xl p-6 ring-1 ring-emerald-500/30">
              <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold sm:text-xl">
                <CheckCircle
                  className="size-6 shrink-0 text-emerald-400"
                  weight="fill"
                />
                ANEXO B — Checklist de Conformidade do Clipador
              </h3>
              <p className="mb-4 text-sm">Antes de enviar links, verifique:</p>
              <div className="space-y-2">
                {[
                  "O vídeo foi editado por mim e segue o tema/regra da Competição.",
                  "O post está em conta minha ou com autorização do titular (posso comprovar).",
                  "Direitos de imagem/música/marcas foram checados e licenciados quando necessário.",
                  "Nenhuma automação proibida foi usada; não comprei métricas.",
                  "Tenho prints e evidências para eventual auditoria (analytics nativo, arquivos do projeto).",
                  "Conferi que o link está público/visível e com as hashtags/descrições exigidas (se houver).",
                  "Estou ciente de que repetição de conteúdo pode eliminar minha participação.",
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
                <Scales
                  className="size-6 shrink-0 text-sky-400"
                  weight="fill"
                />
                ANEXO C — Contatos
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 font-semibold">Titular/Controladora:</p>
                  <p>CLIPFY SOFTWARES TECNOLOGIA LTDA – CNPJ 59.769.545/0001-00</p>
                </div>
                <div>
                  <p className="mb-1 font-semibold">Endereço:</p>
                  <p>
                    Rua Noronha Torrezão, 24, sala 1009, Santa Rosa
                    <br />
                    Niterói/RJ – CEP 24240-182
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-semibold">
                    E-mail para assuntos legais/LGPD:
                  </p>
                  <a
                    href="mailto:legal@clipfyai.com"
                    className="text-brand-cyan hover:underline"
                  >
                    legal@clipfyai.com
                  </a>
                </div>
                <div>
                  <p className="mb-1 font-semibold">Suporte:</p>
                  <a
                    href="mailto:support@clipfyai.com"
                    className="text-brand-cyan hover:underline"
                  >
                    support@clipfyai.com
                  </a>
                </div>
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
