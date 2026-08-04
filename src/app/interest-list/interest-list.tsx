"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CaretDown,
  CaretRight,
  ChatText,
  CheckCircle,
  CircleNotch,
  Clock,
  CurrencyDollar,
  EnvelopeSimple,
  FileText,
  FloppyDisk,
  InstagramLogo,
  MagnifyingGlass,
  Medal,
  Phone,
  Sparkle,
  Target,
  TrendUp,
  User,
  Users,
  YoutubeLogo,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { TikTokIcon } from "@/components/icons/tiktok-icon"
import { Logo } from "@/components/logo"
import { DarkScope } from "@/components/shared/dark-scope"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/trpc/react"

// Lista de países com códigos de telefone e bandeiras
const COUNTRIES = [
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷", format: "(##) #####-####" },
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸", format: "(###) ###-####" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹", format: "### ### ###" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷", format: "## ####-####" },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽", format: "## #### ####" },
  { code: "ES", name: "Espanha", dialCode: "+34", flag: "🇪🇸", format: "### ### ###" },
  { code: "FR", name: "França", dialCode: "+33", flag: "🇫🇷", format: "# ## ## ## ##" },
  { code: "DE", name: "Alemanha", dialCode: "+49", flag: "🇩🇪", format: "### #######" },
  { code: "IT", name: "Itália", dialCode: "+39", flag: "🇮🇹", format: "### ### ####" },
  { code: "GB", name: "Reino Unido", dialCode: "+44", flag: "🇬🇧", format: "#### ######" },
  { code: "CA", name: "Canadá", dialCode: "+1", flag: "🇨🇦", format: "(###) ###-####" },
  { code: "AU", name: "Austrália", dialCode: "+61", flag: "🇦🇺", format: "### ### ###" },
  { code: "JP", name: "Japão", dialCode: "+81", flag: "🇯🇵", format: "##-####-####" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳", format: "### #### ####" },
  { code: "IN", name: "Índia", dialCode: "+91", flag: "🇮🇳", format: "##### #####" },
  { code: "RU", name: "Rússia", dialCode: "+7", flag: "🇷🇺", format: "(###) ###-##-##" },
  { code: "KR", name: "Coreia do Sul", dialCode: "+82", flag: "🇰🇷", format: "##-####-####" },
  { code: "ZA", name: "África do Sul", dialCode: "+27", flag: "🇿🇦", format: "## ### ####" },
  { code: "AE", name: "Emirados Árabes", dialCode: "+971", flag: "🇦🇪", format: "## ### ####" },
  { code: "SA", name: "Arábia Saudita", dialCode: "+966", flag: "🇸🇦", format: "## ### ####" },
  { code: "EG", name: "Egito", dialCode: "+20", flag: "🇪🇬", format: "### ### ####" },
  { code: "NG", name: "Nigéria", dialCode: "+234", flag: "🇳🇬", format: "### ### ####" },
  { code: "CO", name: "Colômbia", dialCode: "+57", flag: "🇨🇴", format: "### ### ####" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱", format: "# #### ####" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪", format: "### ### ###" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪", format: "###-###-####" },
  { code: "EC", name: "Equador", dialCode: "+593", flag: "🇪🇨", format: "## ### ####" },
  { code: "UY", name: "Uruguai", dialCode: "+598", flag: "🇺🇾", format: "## ### ###" },
  { code: "PY", name: "Paraguai", dialCode: "+595", flag: "🇵🇾", format: "### ### ###" },
  { code: "BO", name: "Bolívia", dialCode: "+591", flag: "🇧🇴", format: "# ### ####" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷", format: "#### ####" },
  { code: "PA", name: "Panamá", dialCode: "+507", flag: "🇵🇦", format: "####-####" },
  { code: "DO", name: "Rep. Dominicana", dialCode: "+1", flag: "🇩🇴", format: "(###) ###-####" },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹", format: "#### ####" },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺", format: "# ### ####" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳", format: "####-####" },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻", format: "####-####" },
  { code: "NI", name: "Nicarágua", dialCode: "+505", flag: "🇳🇮", format: "#### ####" },
  { code: "PR", name: "Porto Rico", dialCode: "+1", flag: "🇵🇷", format: "(###) ###-####" },
  { code: "NL", name: "Holanda", dialCode: "+31", flag: "🇳🇱", format: "# ## ## ## ##" },
  { code: "BE", name: "Bélgica", dialCode: "+32", flag: "🇧🇪", format: "### ## ## ##" },
  { code: "CH", name: "Suíça", dialCode: "+41", flag: "🇨🇭", format: "## ### ## ##" },
  { code: "AT", name: "Áustria", dialCode: "+43", flag: "🇦🇹", format: "### ######" },
  { code: "SE", name: "Suécia", dialCode: "+46", flag: "🇸🇪", format: "##-### ## ##" },
  { code: "NO", name: "Noruega", dialCode: "+47", flag: "🇳🇴", format: "### ## ###" },
  { code: "DK", name: "Dinamarca", dialCode: "+45", flag: "🇩🇰", format: "## ## ## ##" },
  { code: "FI", name: "Finlândia", dialCode: "+358", flag: "🇫🇮", format: "## ### ####" },
  { code: "PL", name: "Polônia", dialCode: "+48", flag: "🇵🇱", format: "### ### ###" },
  { code: "CZ", name: "Rep. Tcheca", dialCode: "+420", flag: "🇨🇿", format: "### ### ###" },
  { code: "GR", name: "Grécia", dialCode: "+30", flag: "🇬🇷", format: "### ### ####" },
  { code: "TR", name: "Turquia", dialCode: "+90", flag: "🇹🇷", format: "### ### ####" },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱", format: "##-###-####" },
  { code: "TH", name: "Tailândia", dialCode: "+66", flag: "🇹🇭", format: "## ### ####" },
  { code: "MY", name: "Malásia", dialCode: "+60", flag: "🇲🇾", format: "##-### ####" },
  { code: "SG", name: "Singapura", dialCode: "+65", flag: "🇸🇬", format: "#### ####" },
  { code: "ID", name: "Indonésia", dialCode: "+62", flag: "🇮🇩", format: "###-####-####" },
  { code: "PH", name: "Filipinas", dialCode: "+63", flag: "🇵🇭", format: "### ### ####" },
  { code: "VN", name: "Vietnã", dialCode: "+84", flag: "🇻🇳", format: "## ### ## ##" },
  { code: "NZ", name: "Nova Zelândia", dialCode: "+64", flag: "🇳🇿", format: "## ### ####" },
  { code: "IE", name: "Irlanda", dialCode: "+353", flag: "🇮🇪", format: "## ### ####" },
  { code: "RO", name: "Romênia", dialCode: "+40", flag: "🇷🇴", format: "### ### ###" },
  { code: "HU", name: "Hungria", dialCode: "+36", flag: "🇭🇺", format: "## ### ####" },
  { code: "UA", name: "Ucrânia", dialCode: "+380", flag: "🇺🇦", format: "## ### ####" },
  { code: "MA", name: "Marrocos", dialCode: "+212", flag: "🇲🇦", format: "##-####-###" },
  { code: "KE", name: "Quênia", dialCode: "+254", flag: "🇰🇪", format: "### ######" },
  { code: "GH", name: "Gana", dialCode: "+233", flag: "🇬🇭", format: "## ### ####" },
  { code: "PK", name: "Paquistão", dialCode: "+92", flag: "🇵🇰", format: "### #######" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩", format: "####-######" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", flag: "🇱🇰", format: "## ### ####" },
  { code: "NP", name: "Nepal", dialCode: "+977", flag: "🇳🇵", format: "##-#######" },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼", format: "### ### ###" },
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰", format: "#### ####" },
  { code: "AO", name: "Angola", dialCode: "+244", flag: "🇦🇴", format: "### ### ###" },
  { code: "MZ", name: "Moçambique", dialCode: "+258", flag: "🇲🇿", format: "## ### ####" },
  { code: "CV", name: "Cabo Verde", dialCode: "+238", flag: "🇨🇻", format: "### ## ##" },
  { code: "GW", name: "Guiné-Bissau", dialCode: "+245", flag: "🇬🇼", format: "### ####" },
  { code: "ST", name: "São Tomé e Príncipe", dialCode: "+239", flag: "🇸🇹", format: "### ####" },
  { code: "TL", name: "Timor-Leste", dialCode: "+670", flag: "🇹🇱", format: "### ####" },
]

// Configuração das etapas
const STEPS: Array<{
  id: number
  title: string
  icon: PhosphorIcon
  color: string
}> = [
  { id: 1, title: "Contato", icon: User, color: "from-cyan-500 to-emerald-500" },
  { id: 2, title: "Redes Sociais", icon: InstagramLogo, color: "from-pink-500 to-purple-500" },
  { id: 3, title: "Objetivos", icon: Target, color: "from-orange-500 to-amber-500" },
  { id: 4, title: "Experiência", icon: TrendUp, color: "from-green-500 to-emerald-500" },
  { id: 5, title: "Finalização", icon: FileText, color: "from-purple-500 to-indigo-500" },
]

// Opções
const FOR_WHOM_OPTIONS: Array<{
  value: LeadFormData["forWhom"]
  label: string
  icon: PhosphorIcon
}> = [
  { value: "MYSELF", label: "Para mim (sou o rosto da competição)", icon: User },
  { value: "REPRESENTING_PERSON", label: "Estou representando uma pessoa", icon: Users },
  { value: "REPRESENTING_BRAND", label: "Estou representando uma marca/empresa", icon: Buildings },
]

const URGENCY_OPTIONS = [
  { value: "IMMEDIATE", label: "Preciso para já (< 7 dias)" },
  { value: "SOON", label: "Em breve (7–15 dias)" },
  { value: "EXPLORATORY", label: "Exploratório (> 15 dias)" },
]

const BUDGET_OPTIONS = [
  { value: "RANGE_50_80", label: "R$ 60 mil – 80 mil" },
  { value: "RANGE_80_200", label: "R$ 80 mil – 200 mil" },
  { value: "RANGE_200_500", label: "R$ 200 mil – 500 mil" },
  { value: "ABOVE_500", label: "Acima de R$ 500 mil" },
  { value: "NOT_DEFINED", label: "Ainda não definido (preciso de orientação)" },
]

const SUCCESS_METRICS_OPTIONS = [
  "Views totais",
  "Engajamento (curtidas/comentários)",
  "Crescimento de seguidores",
  "Leads capturados",
  "Vendas/Conversões",
  "Volume de UGC válido (editores ativos)",
]

// Interface de dados
interface LeadFormData {
  // Step 1
  fullName: string
  email: string
  whatsapp: string
  countryCode: string
  forWhom: "MYSELF" | "REPRESENTING_PERSON" | "REPRESENTING_BRAND"

  // Step 2
  instagramHandle: string
  tiktokHandle: string
  youtubeUrl: string

  // Step 3
  objectives: string
  urgency: "IMMEDIATE" | "SOON" | "PLANNING" | "EXPLORATORY"
  budget: "RANGE_50_80" | "RANGE_80_200" | "RANGE_200_500" | "ABOVE_500" | "NOT_DEFINED"

  // Step 4
  hasExperience: boolean
  experienceFeedback: string
  successMetrics: string[]

  // Step 5
  additionalComments: string
  agreeAuthority: boolean
  agreePublicAnalysis: boolean
  agreePrivacyAndTerms: boolean
}

// Partículas do ambiente (vocabulário arena-* da marca)
const TWINKLES: Array<{
  top: string
  left: string
  size: string
  color: string
  dur: string
  delay: string
}> = [
  { top: "10%", left: "6%", size: "size-1", color: "bg-brand-cyan/60", dur: "3.6s", delay: "0s" },
  { top: "18%", left: "90%", size: "size-1.5", color: "bg-brand-mint/50", dur: "4.2s", delay: "0.8s" },
  { top: "34%", left: "14%", size: "size-1", color: "bg-brand-green/50", dur: "3.8s", delay: "1.6s" },
  { top: "48%", left: "94%", size: "size-1", color: "bg-brand-cyan/50", dur: "4.6s", delay: "0.4s" },
  { top: "64%", left: "4%", size: "size-1.5", color: "bg-brand-mint/40", dur: "3.4s", delay: "2.2s" },
  { top: "78%", left: "88%", size: "size-1", color: "bg-brand-green/45", dur: "4s", delay: "1.2s" },
  { top: "88%", left: "30%", size: "size-1", color: "bg-brand-cyan/45", dur: "4.4s", delay: "2.8s" },
  { top: "26%", left: "56%", size: "size-1", color: "bg-brand-mint/45", dur: "3.9s", delay: "3.2s" },
]

/** Ambiente fixo da página: petróleo + grade + auroras + partículas. */
function PageAmbient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(1100px_620px_at_50%_-10%,#0a1c2b_0%,#050f1c_58%,#020910_100%)]" />
      <div className="bg-grid-pattern absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)]" />
      <div className="arena-aurora absolute -top-40 left-1/4 size-96 rounded-full bg-brand-cyan/[0.09] blur-[120px]" />
      <div
        className="arena-aurora absolute right-1/4 -bottom-32 size-96 rounded-full bg-brand-green/[0.08] blur-[120px]"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="arena-aurora absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-mint/[0.04] blur-[150px]"
        style={{ animationDelay: "-3.5s" }}
      />
      {TWINKLES.map((t, i) => (
        <span
          key={i}
          className={`arena-twinkle absolute rounded-full ${t.size} ${t.color}`}
          style={
            {
              top: t.top,
              left: t.left,
              "--twinkle-dur": t.dur,
              "--twinkle-delay": t.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

export default function InterestList() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [leadId, setLeadId] = React.useState<string | null>(null)

  // Mutations para cada etapa
  const createInitial = api.interestList.createInitial.useMutation()
  const updateContact = api.interestList.updateContact.useMutation()
  const updateSocialMedia = api.interestList.updateSocialMedia.useMutation()
  const updateObjectives = api.interestList.updateObjectives.useMutation()
  const updateExperience = api.interestList.updateExperience.useMutation()
  const completeLead = api.interestList.completeLead.useMutation()

  const [data, setData] = React.useState<LeadFormData>({
    // Step 1
    fullName: "",
    email: "",
    whatsapp: "",
    countryCode: "BR",
    forWhom: "REPRESENTING_BRAND",

    // Step 2
    instagramHandle: "",
    tiktokHandle: "",
    youtubeUrl: "",

    // Step 3
    objectives: "",
    urgency: "SOON",
    budget: "NOT_DEFINED",

    // Step 4
    hasExperience: false,
    experienceFeedback: "",
    successMetrics: [],

    // Step 5
    additionalComments: "",
    agreeAuthority: false,
    agreePublicAnalysis: false,
    agreePrivacyAndTerms: false,
  })

  // Máscara para WhatsApp baseada no país selecionado
  const applyPhoneMask = (value: string, countryCode: string): string => {
    const numbers = value.replace(/\D/g, "")
    const country = COUNTRIES.find((c) => c.code === countryCode)

    if (!country) return numbers

    const format = country.format
    let result = ""
    let numIndex = 0

    for (let i = 0; i < format.length && numIndex < numbers.length; i++) {
      if (format[i] === "#") {
        result += numbers[numIndex]!
        numIndex++
      } else {
        result += format[i]!
      }
    }

    return result
  }

  const handlePhoneChange = (value: string) => {
    const maskedValue = applyPhoneMask(value, data.countryCode)
    setData({ ...data, whatsapp: maskedValue })
  }

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRIES.find((c) => c.code === countryCode)
    if (country) {
      setData({ ...data, countryCode, whatsapp: "" })
    }
  }

  const getFullPhoneNumber = (): string => {
    const country = COUNTRIES.find((c) => c.code === data.countryCode)
    if (!country) return data.whatsapp
    return `${country.dialCode} ${data.whatsapp}`
  }

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100

  const handleNext = async () => {
    setIsSubmitting(true)

    try {
      // Step 1: Criar lead inicial
      if (currentStep === 1) {
        // Validações
        if (!data.fullName.trim() || data.fullName.trim().length < 10) {
          toast.error("Nome completo deve ter pelo menos 10 caracteres")
          setIsSubmitting(false)
          return
        }
        if (!/^\s*\S+(?:\s+\S+){1,}\s*$/.test(data.fullName)) {
          toast.error("Digite nome e sobrenome")
          setIsSubmitting(false)
          return
        }
        if (!data.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
          toast.error("E-mail inválido")
          setIsSubmitting(false)
          return
        }
        const phoneNumbers = data.whatsapp.replace(/\D/g, "")
        if (!phoneNumbers || phoneNumbers.length < 8) {
          toast.error("WhatsApp inválido - insira um número válido")
          setIsSubmitting(false)
          return
        }

        // Criar lead com número completo — ou apenas atualizar o que já existe
        // se o usuário voltou para corrigir algo (senão duplicaria o registro
        // e o e-mail de notificação a cada ida e volta).
        const fullPhone = getFullPhoneNumber()
        if (leadId) {
          await updateContact.mutateAsync({
            id: leadId,
            fullName: data.fullName,
            email: data.email,
            whatsapp: fullPhone,
            forWhom: data.forWhom,
          })
        } else {
          const result = await createInitial.mutateAsync({
            fullName: data.fullName,
            email: data.email,
            whatsapp: fullPhone,
            forWhom: data.forWhom,
          })

          setLeadId(result.id)
        }
        toast.success("✅ Dados salvos com sucesso!")
      }

      // Step 2: Atualizar redes sociais
      else if (currentStep === 2) {
        if (!data.instagramHandle.trim() || data.instagramHandle.length < 2) {
          toast.error("Instagram é obrigatório")
          setIsSubmitting(false)
          return
        }
        if (!/^@?[A-Za-z0-9._]{2,30}$/.test(data.instagramHandle)) {
          toast.error("Handle do Instagram inválido")
          setIsSubmitting(false)
          return
        }

        if (!leadId) {
          toast.error("Erro: Lead não encontrado. Volte à primeira etapa.")
          setIsSubmitting(false)
          return
        }

        await updateSocialMedia.mutateAsync({
          id: leadId,
          instagramHandle: data.instagramHandle,
          tiktokHandle: data.tiktokHandle || undefined,
          youtubeUrl: data.youtubeUrl || undefined,
        })

        toast.success("✅ Redes sociais salvas!")
      }

      // Step 3: Atualizar objetivos
      else if (currentStep === 3) {
        if (!data.objectives.trim() || data.objectives.length < 50) {
          toast.error("Objetivos devem ter pelo menos 50 caracteres")
          setIsSubmitting(false)
          return
        }
        if (data.objectives.length > 400) {
          toast.error("Objetivos devem ter no máximo 400 caracteres")
          setIsSubmitting(false)
          return
        }

        if (!leadId) {
          toast.error("Erro: Lead não encontrado. Volte à primeira etapa.")
          setIsSubmitting(false)
          return
        }

        await updateObjectives.mutateAsync({
          id: leadId,
          objectives: data.objectives,
          urgency: data.urgency,
          budget: data.budget,
        })

        toast.success("✅ Objetivos salvos!")
      }

      // Step 4: Atualizar experiência
      else if (currentStep === 4) {
        if (data.successMetrics.length === 0) {
          toast.error("Selecione pelo menos 1 métrica de sucesso")
          setIsSubmitting(false)
          return
        }

        if (!leadId) {
          toast.error("Erro: Lead não encontrado. Volte à primeira etapa.")
          setIsSubmitting(false)
          return
        }

        await updateExperience.mutateAsync({
          id: leadId,
          hasExperience: data.hasExperience,
          experienceFeedback: data.experienceFeedback || undefined,
          successMetrics: data.successMetrics,
        })

        toast.success("✅ Experiência salva!")
      }

      // Step 5: Finalizar
      else if (currentStep === 5) {
        if (!data.agreeAuthority) {
          toast.error("Você deve confirmar que tem poderes para contratar")
          setIsSubmitting(false)
          return
        }
        if (!data.agreePublicAnalysis) {
          toast.error("Você deve autorizar a análise pública")
          setIsSubmitting(false)
          return
        }
        if (!data.agreePrivacyAndTerms) {
          toast.error("Você deve concordar com a Política de Privacidade")
          setIsSubmitting(false)
          return
        }

        if (!leadId) {
          toast.error("Erro: Lead não encontrado. Volte à primeira etapa.")
          setIsSubmitting(false)
          return
        }

        await completeLead.mutateAsync({
          id: leadId,
          additionalComments: data.additionalComments || undefined,
          agreeAuthority: data.agreeAuthority,
          agreePublicAnalysis: data.agreePublicAnalysis,
          agreePrivacyAndTerms: data.agreePrivacyAndTerms,
        })

        setIsSuccess(true)

        // Redirecionar após 5 segundos
        setTimeout(() => {
          router.push("/")
        }, 5000)

        setIsSubmitting(false)
        return
      }

      // Avançar para próxima etapa
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined
      toast.error("❌ Erro ao salvar dados", {
        description: message || "Tente novamente",
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <DarkScope className="text-foreground relative min-h-svh overflow-x-clip bg-[#030d18]">
      <PageAmbient />

      {/* Conteúdo */}
      <div className="relative z-10 min-h-svh">
        {/* Success Message */}
        {isSuccess ? (
          <div className="min-h-svh py-8 sm:py-12">
            <div className="mx-auto max-w-4xl px-4">
              {/* Logo */}
              <div className="animate-fade-in mb-8 text-center sm:mb-12">
                <div className="mb-6 flex justify-center sm:mb-8">
                  <Link href="/" aria-label="Clipfy League">
                    <Logo
                      width={200}
                      height={50}
                      shadow={false}
                      className="h-auto w-40 drop-shadow-[0_0_24px_rgba(20,247,254,0.3)] sm:w-48 md:w-56"
                    />
                  </Link>
                </div>
              </div>

              <div className="animate-fade-in mx-auto max-w-3xl">
                <div className="flex flex-col items-center space-y-8 py-12 text-center">
                  {/* Animated Success Icon */}
                  <div className="relative">
                    <div className="bg-gradient-custom absolute inset-0 rounded-full opacity-50 blur-3xl" />
                    <div className="bg-gradient-custom relative flex h-32 w-32 animate-bounce items-center justify-center rounded-full shadow-2xl shadow-brand-cyan/50">
                      <CheckCircle className="size-16 text-[#04222A]" weight="fill" />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-4">
                    <h1 className="text-gradient animate-gradient text-4xl font-bold sm:text-5xl md:text-6xl">
                      Solicitação Enviada!
                    </h1>
                    <div className="bg-gradient-custom mx-auto h-1.5 w-32 rounded-full shadow-lg shadow-brand-cyan/50" />
                  </div>

                  {/* Message */}
                  <div className="max-w-2xl space-y-4">
                    <p className="text-xl font-semibold text-white/90 sm:text-2xl">
                      Recebemos sua solicitação com sucesso! 🎉
                    </p>
                    <p className="text-base leading-relaxed text-white/60 sm:text-lg">
                      Nossa equipe entrará em contato em breve para discutir os detalhes da sua{" "}
                      <span className="text-brand-cyan font-semibold">competição de cortes</span>.
                    </p>
                  </div>

                  {/* Features Grid */}
                  <div className="grid w-full max-w-4xl grid-cols-1 gap-6 pt-8 sm:grid-cols-3">
                    <div className="glass-card glass-card-hover rounded-2xl">
                      <div className="flex flex-col items-center space-y-4 p-6 text-center">
                        <div className="bg-brand-cyan/15 ring-brand-cyan/30 flex size-16 items-center justify-center rounded-full shadow-lg shadow-brand-cyan/20 ring-2">
                          <Clock className="text-brand-cyan size-8" weight="duotone" />
                        </div>
                        <div>
                          <h3 className="text-brand-cyan mb-1 text-lg font-bold">Resposta Rápida</h3>
                          <p className="text-sm text-white/60">Retorno em até 24 horas</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card glass-card-hover rounded-2xl">
                      <div className="flex flex-col items-center space-y-4 p-6 text-center">
                        <div className="bg-brand-mint/15 ring-brand-mint/30 flex size-16 items-center justify-center rounded-full shadow-lg shadow-brand-mint/20 ring-2">
                          <User className="text-brand-mint size-8" weight="duotone" />
                        </div>
                        <div>
                          <h3 className="text-brand-mint mb-1 text-lg font-bold">Consultoria Grátis</h3>
                          <p className="text-sm text-white/60">Análise completa sem custo</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card glass-card-hover rounded-2xl">
                      <div className="flex flex-col items-center space-y-4 p-6 text-center">
                        <div className="bg-brand-green/15 ring-brand-green/30 flex size-16 items-center justify-center rounded-full shadow-lg shadow-brand-green/20 ring-2">
                          <Medal className="text-brand-green size-8" weight="duotone" />
                        </div>
                        <div>
                          <h3 className="text-brand-green mb-1 text-lg font-bold">Proposta Personalizada</h3>
                          <p className="text-sm text-white/60">Solução sob medida</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="glass-card mt-8 w-full max-w-2xl rounded-2xl">
                    <div className="p-6 sm:p-8">
                      <div className="space-y-4 text-center">
                        <div className="bg-brand-cyan/15 ring-brand-cyan/30 mb-2 inline-flex size-12 items-center justify-center rounded-full ring-2">
                          <EnvelopeSimple className="text-brand-cyan size-6" weight="duotone" />
                        </div>
                        <div>
                          <p className="mb-2 text-white/80">Dúvidas ou quer falar conosco?</p>
                          <a
                            href="mailto:luiz.felipe@clipfyai.com"
                            className="text-brand-cyan text-xl font-semibold transition-opacity hover:opacity-80"
                          >
                            luiz.felipe@clipfyai.com
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Auto-redirect message */}
                  <div className="pt-8">
                    <p className="flex items-center justify-center gap-2 text-sm text-white/50">
                      <CircleNotch className="text-brand-cyan size-4 animate-spin" />
                      Redirecionando em alguns segundos...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header com Progress - Sticky */}
            <div className="sticky top-0 z-20 border-b border-white/10 bg-[#030d18]/85 backdrop-blur-xl">
              <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
                {/* Logo */}
                <div className="mb-4 flex justify-center">
                  <Link href="/" aria-label="Clipfy League">
                    <Logo
                      width={150}
                      height={40}
                      shadow={false}
                      className="h-auto w-32 sm:w-40"
                    />
                  </Link>
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold text-white sm:text-xl">Lista de Interesse</h1>
                    <p className="mt-0.5 text-xs text-white/60 sm:text-sm">
                      Etapa {currentStep} de {STEPS.length}
                      {leadId && (
                        <span className="text-brand-green ml-2">
                          <FloppyDisk className="mr-1 inline size-3" />
                          Salvando automaticamente
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan px-3 py-1 text-xs sm:text-sm"
                  >
                    {Math.round(progress)}% concluído
                  </Badge>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="bg-gradient-custom absolute inset-y-0 left-0 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Steps Indicators */}
                <div className="mt-4 flex items-center justify-between overflow-x-auto pt-2 pb-2">
                  {STEPS.map((step, index) => {
                    const StepIcon = step.icon
                    const isActive = currentStep === step.id
                    const isCompleted = currentStep > step.id

                    return (
                      <div key={step.id} className="flex shrink-0 items-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 sm:h-10 sm:w-10 ${
                              isCompleted
                                ? `bg-gradient-to-br ${step.color} text-white shadow-lg`
                                : isActive
                                  ? `bg-gradient-to-br ${step.color} scale-110 text-white shadow-lg`
                                  : "bg-white/10 text-white/40"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="size-4 sm:size-5" weight="fill" />
                            ) : (
                              <StepIcon className="size-4 sm:size-5" />
                            )}
                          </div>
                          <span
                            className={`hidden text-[10px] font-medium sm:block sm:text-xs ${
                              isActive ? "text-white" : "text-white/40"
                            }`}
                          >
                            {step.title}
                          </span>
                        </div>
                        {index < STEPS.length - 1 && (
                          <CaretRight className="mx-1 size-3 shrink-0 text-white/25 sm:mx-2 sm:size-4" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
              <div className="glass-card rounded-3xl shadow-2xl shadow-brand-cyan/5">
                <div className="p-6 sm:p-8 lg:p-10">
                  {/* Step Content */}
                  {currentStep === 1 && (
                    <Step1ContactInfo
                      data={data}
                      setData={setData}
                      handlePhoneChange={handlePhoneChange}
                      handleCountryChange={handleCountryChange}
                    />
                  )}
                  {currentStep === 2 && (
                    <Step2SocialMedia data={data} setData={setData} />
                  )}
                  {currentStep === 3 && (
                    <Step3Objectives data={data} setData={setData} />
                  )}
                  {currentStep === 4 && (
                    <Step4Experience data={data} setData={setData} />
                  )}
                  {currentStep === 5 && (
                    <Step5Final data={data} setData={setData} />
                  )}

                  {/* Navigation Buttons */}
                  <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-6">
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      disabled={currentStep === 1 || isSubmitting}
                      className="h-11 cursor-pointer gap-2 rounded-xl border-white/15 text-white/80 hover:bg-white/5 hover:text-white"
                    >
                      <ArrowLeft className="size-4" />
                      Voltar
                    </Button>

                    <Button
                      onClick={handleNext}
                      disabled={isSubmitting}
                      className="btn-gradient-auth h-11 min-w-32 cursor-pointer gap-2 rounded-xl font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-8px_rgba(55,250,156,0.5)]"
                    >
                      {isSubmitting ? (
                        <>
                          <CircleNotch className="size-4 animate-spin" />
                          Salvando...
                        </>
                      ) : currentStep === STEPS.length ? (
                        <>
                          Enviar Solicitação
                          <CheckCircle className="size-4" weight="fill" />
                        </>
                      ) : (
                        <>
                          Salvar e Continuar
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 pb-8 text-center">
                <p className="text-sm text-white/50">
                  Dúvidas? Entre em contato:{" "}
                  <a
                    href="mailto:luiz.felipe@clipfyai.com"
                    className="text-brand-cyan underline transition-opacity hover:opacity-80"
                  >
                    luiz.felipe@clipfyai.com
                  </a>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </DarkScope>
  )
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

// Step 1: Contact Info
function Step1ContactInfo({
  data,
  setData,
  handlePhoneChange,
  handleCountryChange,
}: {
  data: LeadFormData
  setData: React.Dispatch<React.SetStateAction<LeadFormData>>
  handlePhoneChange: (value: string) => void
  handleCountryChange: (countryCode: string) => void
}) {
  const [countrySearch, setCountrySearch] = React.useState("")
  const [isCountryOpen, setIsCountryOpen] = React.useState(false)

  const selectedCountry = React.useMemo(
    () => COUNTRIES.find((c) => c.code === data.countryCode) ?? COUNTRIES[0]!,
    [data.countryCode],
  )

  const filteredCountries = React.useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES
    const search = countrySearch.toLowerCase()
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase().includes(search),
    )
  }, [countrySearch])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/50 sm:h-16 sm:w-16">
          <User className="size-7 text-white sm:size-8" weight="fill" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Informações de Contato</h2>
        <p className="text-white/60">Vamos começar com seus dados básicos</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="fullName" className="font-semibold text-white/90">
            Nome Completo <span className="text-red-400">*</span>
          </Label>
          <Input
            id="fullName"
            value={data.fullName}
            onChange={(e) => setData({ ...data, fullName: e.target.value })}
            placeholder="Ex.: João da Silva"
            className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="font-semibold text-white/90">
            E-mail de Trabalho <span className="text-red-400">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            placeholder="Ex.: nome@empresa.com.br"
            className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-semibold text-white/90">
            WhatsApp <span className="text-red-400">*</span>
          </Label>

          {/* Container do Telefone com Seletor de País */}
          <div className="flex gap-2">
            {/* Seletor de País com Bandeira */}
            <Popover open={isCountryOpen} onOpenChange={setIsCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isCountryOpen}
                  className="h-12 w-[130px] shrink-0 cursor-pointer justify-between rounded-xl border-white/15 text-white hover:bg-white/5 hover:text-white sm:w-[150px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xl">{selectedCountry.flag}</span>
                    <span className="text-sm font-medium">{selectedCountry.dialCode}</span>
                  </div>
                  <CaretDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0 sm:w-[380px]" align="start">
                {/* Busca */}
                <div className="border-b border-white/10 p-3">
                  <div className="relative">
                    <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
                    <Input
                      placeholder="Buscar país, código ou DDI..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-9"
                    />
                  </div>
                </div>

                {/* Lista de Países */}
                <ScrollArea className="h-[300px]">
                  <div className="p-2">
                    {filteredCountries.length === 0 ? (
                      <div className="py-6 text-center text-sm text-white/40">
                        Nenhum país encontrado
                      </div>
                    ) : (
                      filteredCountries.map((country) => {
                        const isSelected = country.code === data.countryCode
                        return (
                          <Button
                            key={country.code}
                            variant="ghost"
                            onClick={() => {
                              handleCountryChange(country.code)
                              setIsCountryOpen(false)
                              setCountrySearch("")
                            }}
                            className={`mb-1 h-auto w-full cursor-pointer justify-start rounded-xl px-3 py-3 transition-all ${
                              isSelected
                                ? "border-brand-cyan/50 bg-brand-cyan/15 border text-white"
                                : "text-white/75 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <div className="flex w-full items-center gap-3">
                              <span className="text-2xl">{country.flag}</span>
                              <div className="min-w-0 flex-1 text-left">
                                <p
                                  className={`truncate font-medium ${
                                    isSelected ? "text-white" : "text-white/85"
                                  }`}
                                >
                                  {country.name}
                                </p>
                                <p className="text-xs text-white/40">{country.code}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`shrink-0 ${
                                  isSelected
                                    ? "border-brand-cyan/50 bg-brand-cyan/15 text-brand-cyan"
                                    : "border-white/15 text-white/60"
                                }`}
                              >
                                {country.dialCode}
                              </Badge>
                              {isSelected && (
                                <CheckCircle
                                  className="text-brand-cyan size-4 shrink-0"
                                  weight="fill"
                                />
                              )}
                            </div>
                          </Button>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* Footer com contagem */}
                <div className="border-t border-white/10 bg-white/[0.03] p-2">
                  <p className="text-center text-xs text-white/40">
                    {filteredCountries.length} de {COUNTRIES.length} países
                  </p>
                </div>
              </PopoverContent>
            </Popover>

            {/* Input do Número */}
            <div className="relative flex-1">
              <Phone className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
              <Input
                type="tel"
                value={data.whatsapp}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={selectedCountry.format.replace(/#/g, "0")}
                className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pl-10"
              />
            </div>
          </div>

          {/* Info do país selecionado */}
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="text-base">{selectedCountry.flag}</span>
            <span>{selectedCountry.name}</span>
            <span className="text-brand-cyan font-medium">{selectedCountry.dialCode}</span>
            <span className="text-white/25">•</span>
            <span className="text-white/25">Formato: {selectedCountry.format}</span>
          </div>
        </div>
      </div>

      <Separator className="my-6 bg-white/10" />

      {/* Para quem é a competição */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand-green/15 ring-brand-green/30 flex size-10 items-center justify-center rounded-xl ring-2">
            <Target className="text-brand-green size-5" weight="duotone" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Para quem é a competição? <span className="text-red-400">*</span>
            </h3>
            <p className="text-xs text-white/60">Selecione uma opção</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {FOR_WHOM_OPTIONS.map((option) => {
            const OptionIcon = option.icon
            const isSelected = data.forWhom === option.value

            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                onClick={() => setData({ ...data, forWhom: option.value })}
                className={`h-auto cursor-pointer rounded-xl px-4 py-4 text-left transition-all ${
                  isSelected
                    ? "border-brand-cyan bg-brand-cyan/10 text-white"
                    : "hover:border-brand-cyan/50 border-white/15 text-white/75 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex w-full items-center gap-3">
                  {isSelected && (
                    <CheckCircle className="text-brand-cyan size-5 shrink-0" weight="fill" />
                  )}
                  <OptionIcon className="size-5 shrink-0" />
                  <span className="flex-1 text-sm whitespace-normal">{option.label}</span>
                </div>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Step 2: Social Media
function Step2SocialMedia({
  data,
  setData,
}: {
  data: LeadFormData
  setData: React.Dispatch<React.SetStateAction<LeadFormData>>
}) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg shadow-pink-500/50 sm:h-16 sm:w-16">
          <InstagramLogo className="size-7 text-white sm:size-8" weight="fill" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Redes Sociais</h2>
        <p className="text-white/60">Perfis do rosto da competição</p>
      </div>

      <div className="space-y-6">
        {/* Instagram */}
        <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-transparent">
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-pink-500/20">
                <InstagramLogo className="size-5 text-pink-400" weight="duotone" />
              </div>
              <div>
                <Label className="text-base font-semibold text-white">
                  Instagram <span className="text-red-400">*</span>
                </Label>
                <p className="text-xs text-white/60">Handle obrigatório</p>
              </div>
            </div>
            <Input
              value={data.instagramHandle}
              onChange={(e) => setData({ ...data, instagramHandle: e.target.value })}
              placeholder="@seuusuario"
              className="h-12 rounded-xl focus-visible:ring-pink-500/40"
            />
          </div>
        </div>

        {/* TikTok */}
        <div className="rounded-2xl border border-[#f1204a]/30 bg-gradient-to-br from-[#f1204a]/5 to-transparent">
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#f1204a]/20">
                <TikTokIcon className="h-5 w-5" />
              </div>
              <div>
                <Label className="text-base font-semibold text-white">TikTok</Label>
                <p className="text-xs text-white/60">Opcional</p>
              </div>
            </div>
            <Input
              value={data.tiktokHandle}
              onChange={(e) => setData({ ...data, tiktokHandle: e.target.value })}
              placeholder="@seuusuario"
              className="h-12 rounded-xl focus-visible:ring-[#f1204a]/40"
            />
          </div>
        </div>

        {/* YouTube */}
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent">
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/20">
                <YoutubeLogo className="size-5 text-red-400" weight="duotone" />
              </div>
              <div>
                <Label className="text-base font-semibold text-white">YouTube</Label>
                <p className="text-xs text-white/60">Opcional - URL completa</p>
              </div>
            </div>
            <Input
              value={data.youtubeUrl}
              onChange={(e) => setData({ ...data, youtubeUrl: e.target.value })}
              placeholder="https://youtube.com/@seucanal"
              className="h-12 rounded-xl focus-visible:ring-red-500/40"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 3: Objectives
function Step3Objectives({
  data,
  setData,
}: {
  data: LeadFormData
  setData: React.Dispatch<React.SetStateAction<LeadFormData>>
}) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/50 sm:h-16 sm:w-16">
          <Target className="size-7 text-white sm:size-8" weight="fill" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Objetivos da Competição</h2>
        <p className="text-white/60">Conte-nos suas metas e prazo</p>
      </div>

      {/* Objetivos */}
      <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/20">
              <Target className="size-5 text-orange-400" weight="duotone" />
            </div>
            <div>
              <Label className="text-base font-semibold text-white">
                Objetivos <span className="text-red-400">*</span>
              </Label>
              <p className="text-xs text-white/60">Em 1-2 frases, quais seus objetivos?</p>
            </div>
          </div>

          <Textarea
            value={data.objectives}
            onChange={(e) => setData({ ...data, objectives: e.target.value })}
            placeholder="Ex.: Gerar awareness e 2.000 UGCs válidos em 8 semanas, priorizando Instagram e TikTok."
            className="min-h-[100px] resize-none rounded-xl focus-visible:ring-orange-500/40"
          />
          <p className="text-xs text-white/40">
            {data.objectives.length}/400 caracteres (mínimo 50)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Urgência */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/20">
                <Clock className="size-5 text-amber-400" weight="duotone" />
              </div>
              <div>
                <Label className="text-base font-semibold text-white">
                  Urgência <span className="text-red-400">*</span>
                </Label>
                <p className="text-xs text-white/60">Quando deseja lançar?</p>
              </div>
            </div>

            <div className="space-y-2">
              {URGENCY_OPTIONS.map((option) => {
                const isSelected = data.urgency === option.value

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setData({ ...data, urgency: option.value as LeadFormData["urgency"] })
                    }
                    className={`h-auto w-full cursor-pointer justify-start rounded-xl px-4 py-3 text-sm transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 text-white"
                        : "border-white/15 text-white/75 hover:border-amber-500/50 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle className="mr-2 size-4 shrink-0 text-amber-400" weight="fill" />
                    )}
                    <span className="whitespace-normal">{option.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Orçamento */}
        <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/20">
                <CurrencyDollar className="size-5 text-green-400" weight="duotone" />
              </div>
              <div>
                <Label className="text-base font-semibold text-white">
                  Orçamento <span className="text-red-400">*</span>
                </Label>
                <p className="text-xs text-white/60">Faixa disponível</p>
              </div>
            </div>

            <div className="space-y-2">
              {BUDGET_OPTIONS.map((option) => {
                const isSelected = data.budget === option.value

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setData({ ...data, budget: option.value as LeadFormData["budget"] })
                    }
                    className={`h-auto w-full cursor-pointer justify-start rounded-xl px-4 py-3 text-sm transition-all ${
                      isSelected
                        ? "border-green-500 bg-green-500/10 text-white"
                        : "border-white/15 text-white/75 hover:border-green-500/50 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle className="mr-2 size-4 shrink-0 text-green-400" weight="fill" />
                    )}
                    <span className="whitespace-normal">{option.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 4: Experience
function Step4Experience({
  data,
  setData,
}: {
  data: LeadFormData
  setData: React.Dispatch<React.SetStateAction<LeadFormData>>
}) {
  const toggleSuccessMetric = (metric: string) => {
    if (data.successMetrics.includes(metric)) {
      setData({ ...data, successMetrics: data.successMetrics.filter((m) => m !== metric) })
    } else if (data.successMetrics.length < 3) {
      setData({ ...data, successMetrics: [...data.successMetrics, metric] })
    } else {
      toast.error("Você pode selecionar no máximo 3 métricas")
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/50 sm:h-16 sm:w-16">
          <TrendUp className="size-7 text-white sm:size-8" weight="fill" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Experiência e Métricas</h2>
        <p className="text-white/60">Conte-nos sobre sua experiência anterior</p>
      </div>

      {/* Experiência prévia */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-transparent">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/20">
              <Medal className="size-5 text-indigo-400" weight="duotone" />
            </div>
            <div>
              <Label className="text-base font-semibold text-white">
                Já fez competição de cortes antes?
              </Label>
              <p className="text-xs text-white/60">Opcional</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setData({ ...data, hasExperience: true })}
              className={`h-auto flex-1 cursor-pointer rounded-xl py-4 transition-all ${
                data.hasExperience
                  ? "border-indigo-500 bg-indigo-500/10 text-white"
                  : "border-white/15 text-white/75 hover:border-indigo-500/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              {data.hasExperience && (
                <CheckCircle className="mr-2 size-5 text-indigo-400" weight="fill" />
              )}
              Sim
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setData({ ...data, hasExperience: false, experienceFeedback: "" })}
              className={`h-auto flex-1 cursor-pointer rounded-xl py-4 transition-all ${
                !data.hasExperience
                  ? "border-indigo-500 bg-indigo-500/10 text-white"
                  : "border-white/15 text-white/75 hover:border-indigo-500/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              {!data.hasExperience && (
                <CheckCircle className="mr-2 size-5 text-indigo-400" weight="fill" />
              )}
              Não
            </Button>
          </div>

          {data.hasExperience && (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <Label className="text-sm text-white/80">
                O que funcionou e o que não funcionou?{" "}
                <span className="text-white/40">(opcional)</span>
              </Label>
              <Textarea
                value={data.experienceFeedback}
                onChange={(e) => setData({ ...data, experienceFeedback: e.target.value })}
                placeholder="Ex.: Funcionou: premiação escalonada; Não funcionou: regras confusas."
                className="min-h-[80px] resize-none rounded-xl focus-visible:ring-indigo-500/40"
              />
              <p className="text-xs text-white/40">
                {data.experienceFeedback.length}/300 caracteres
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Métricas de Sucesso */}
      <div className="border-brand-cyan/30 from-brand-cyan/5 rounded-2xl border bg-gradient-to-br to-transparent">
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-brand-cyan/15 flex size-10 items-center justify-center rounded-lg">
                <TrendUp className="text-brand-cyan size-5" weight="duotone" />
              </div>
              <div>
                <Label className="text-base font-semibold text-white">
                  Métricas de Sucesso <span className="text-red-400">*</span>
                </Label>
                <p className="text-xs text-white/60">Escolha até 3 métricas que mais importam</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`border-brand-cyan/30 ${
                data.successMetrics.length > 0
                  ? "bg-brand-cyan/10 text-brand-cyan"
                  : "text-white/60"
              }`}
            >
              {data.successMetrics.length}/3
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SUCCESS_METRICS_OPTIONS.map((metric) => {
              const isSelected = data.successMetrics.includes(metric)
              const isDisabled = !isSelected && data.successMetrics.length >= 3

              return (
                <Button
                  key={metric}
                  type="button"
                  variant="outline"
                  onClick={() => toggleSuccessMetric(metric)}
                  disabled={isDisabled}
                  className={`h-auto cursor-pointer rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-brand-cyan bg-brand-cyan/10 text-white"
                      : isDisabled
                        ? "cursor-not-allowed border-white/10 text-white/30 opacity-40"
                        : "hover:border-brand-cyan/50 border-white/15 text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {isSelected && (
                    <CheckCircle className="text-brand-cyan mr-2 size-4 shrink-0" weight="fill" />
                  )}
                  <span className="flex-1 text-left whitespace-normal">{metric}</span>
                </Button>
              )
            })}
          </div>

          {data.successMetrics.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {data.successMetrics.map((metric) => (
                <Badge
                  key={metric}
                  className="from-brand-cyan/20 to-brand-green/20 border-brand-cyan/30 border bg-gradient-to-r text-white"
                >
                  {metric}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Step 5: Final
function Step5Final({
  data,
  setData,
}: {
  data: LeadFormData
  setData: React.Dispatch<React.SetStateAction<LeadFormData>>
}) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/50 sm:h-16 sm:w-16">
          <FileText className="size-7 text-white sm:size-8" weight="fill" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Finalização</h2>
        <p className="text-white/60">Últimos detalhes e consentimentos</p>
      </div>

      {/* Comentários Adicionais */}
      <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-yellow-500/20">
              <ChatText className="size-5 text-yellow-400" weight="duotone" />
            </div>
            <div>
              <Label className="text-base font-semibold text-white">
                Comentários ou Observações
              </Label>
              <p className="text-xs text-white/60">Opcional - restrições, datas-chave, etc.</p>
            </div>
          </div>

          <Textarea
            value={data.additionalComments}
            onChange={(e) => setData({ ...data, additionalComments: e.target.value })}
            placeholder="Ex.: Restrições de marca, datas-chave, públicos prioritários..."
            className="min-h-[100px] resize-none rounded-xl focus-visible:ring-yellow-500/40"
          />
          <p className="text-xs text-white/40">
            {data.additionalComments.length}/800 caracteres
          </p>
        </div>
      </div>

      {/* Consentimentos */}
      <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent">
        <div className="space-y-4 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/20">
              <CheckCircle className="size-5 text-red-400" weight="duotone" />
            </div>
            <div>
              <Label className="text-base font-semibold text-white">
                Confirmações e Consentimentos <span className="text-red-400">*</span>
              </Label>
              <p className="text-xs text-white/60">Todos os campos são obrigatórios</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="agreeAuthority"
                checked={data.agreeAuthority}
                onCheckedChange={(checked) =>
                  setData({ ...data, agreeAuthority: checked === true })
                }
                className="data-[state=checked]:bg-gradient-custom mt-1 data-[state=checked]:border-0 data-[state=checked]:text-[#04222A]"
              />
              <Label
                htmlFor="agreeAuthority"
                className="cursor-pointer text-sm leading-relaxed text-white/80"
              >
                Confirmo que tenho poderes para contratar ou intermediar esta contratação.
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="agreePublicAnalysis"
                checked={data.agreePublicAnalysis}
                onCheckedChange={(checked) =>
                  setData({ ...data, agreePublicAnalysis: checked === true })
                }
                className="data-[state=checked]:bg-gradient-custom mt-1 data-[state=checked]:border-0 data-[state=checked]:text-[#04222A]"
              />
              <Label
                htmlFor="agreePublicAnalysis"
                className="cursor-pointer text-sm leading-relaxed text-white/80"
              >
                Autorizo a análise pública de perfis e conteúdos para avaliação de viabilidade.
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="agreePrivacyAndTerms"
                checked={data.agreePrivacyAndTerms}
                onCheckedChange={(checked) =>
                  setData({ ...data, agreePrivacyAndTerms: checked === true })
                }
                className="data-[state=checked]:bg-gradient-custom mt-1 data-[state=checked]:border-0 data-[state=checked]:text-[#04222A]"
              />
              <Label
                htmlFor="agreePrivacyAndTerms"
                className="cursor-pointer text-sm leading-relaxed text-white/80"
              >
                <span>
                  Li e concordo com a{" "}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-cyan underline transition-opacity hover:opacity-80"
                  >
                    Política de Privacidade
                  </a>{" "}
                  e os Termos de Pré-qualificação.
                </span>
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="border-brand-cyan/30 from-brand-cyan/5 rounded-2xl border bg-gradient-to-br to-transparent">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-brand-cyan/15 flex size-10 items-center justify-center rounded-lg">
              <Sparkle className="text-brand-cyan size-5" weight="duotone" />
            </div>
            <div>
              <Label className="text-base font-semibold text-white">Resumo da Solicitação</Label>
              <p className="text-xs text-white/60">Confira os dados antes de enviar</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-white/60">Nome:</p>
              <p className="font-medium text-white">{data.fullName || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60">E-mail:</p>
              <p className="font-medium text-white">{data.email || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60">Instagram:</p>
              <p className="text-brand-cyan font-medium">{data.instagramHandle || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60">Urgência:</p>
              <p className="font-medium text-white">
                {URGENCY_OPTIONS.find((o) => o.value === data.urgency)?.label ?? "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60">Orçamento:</p>
              <p className="font-medium text-white">
                {BUDGET_OPTIONS.find((o) => o.value === data.budget)?.label ?? "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60">Métricas de Sucesso:</p>
              <p className="font-medium text-white">
                {data.successMetrics.length > 0 ? data.successMetrics.join(", ") : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
