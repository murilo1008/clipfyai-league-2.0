import { createTRPCRouter, publicProcedure, adminProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Emails dos responsáveis comerciais
const COMMERCIAL_EMAILS = [
  "luiz.felipe@clipfyai.com",
  "ivan@clipfyai.com",
];

// Configurações de mapeamento
const FOR_WHOM_LABELS: Record<string, string> = {
  MYSELF: "Para mim (sou o rosto da competição)",
  REPRESENTING_PERSON: "Representando uma pessoa",
  REPRESENTING_BRAND: "Representando uma marca/empresa",
};

// Função para selecionar aleatoriamente um email (50% cada)
function getRandomCommercialEmail(): string {
  const randomIndex = Math.random() < 0.5 ? 0 : 1;
  return COMMERCIAL_EMAILS[randomIndex]!;
}

// Template de email de notificação de novo lead
function getNewLeadNotificationEmailTemplate(
  leadId: string,
  fullName: string,
  email: string,
  whatsapp: string,
  forWhom: string,
  createdAt: Date,
  assignedTo: string
) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const forWhomLabel = FOR_WHOM_LABELS[forWhom] || forWhom;
  
  // Formatar WhatsApp para link
  const whatsappClean = whatsapp.replace(/\D/g, '');
  const whatsappLink = `https://wa.me/${whatsappClean}`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Lead - ClipfyAI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header com Logo -->
    <div style="text-align: center; padding: 32px 24px;">
      <a href="https://www.clipfyai.com" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="https://framerusercontent.com/images/yDoe24MwEeKgmJpW2aiCrKIxzs.png?scale-down-to=512" 
             alt="Clipfy League" 
             width="250" 
             style="display: block; width: 250px; height: auto; border: 0; margin: 0 auto;" />
      </a>
    </div>

    <!-- Banner Principal -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 2px solid #14F7FF; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 30px rgba(20, 247, 255, 0.2);">
      <div style="font-size: 64px; margin-bottom: 16px;">🔔</div>
      <h1 style="margin: 0; font-size: 36px; font-weight: 900; color: #14F7FF; line-height: 1.2; letter-spacing: -0.5px;">
        NOVO LEAD!
      </h1>
      <p style="margin: 16px 0 0 0; font-size: 18px; font-weight: 600; color: #37FF9F;">
        Um novo interessado acabou de se cadastrar! 🚀
      </p>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Dados do Lead -->
      <div style="background: #111111; border: 2px solid #14F7FF; border-radius: 16px; padding: 32px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #14F7FF; text-transform: uppercase; letter-spacing: 1px;">
            👤 Nome Completo
          </p>
          <p style="margin: 0; font-size: 32px; font-weight: 900; color: #ffffff; line-height: 1.2;">
            ${fullName}
          </p>
        </div>

        <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #14F7FF 50%, transparent 100%); margin: 24px 0;"></div>

        <div style="space-y: 16px;">
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              📧 E-mail
            </p>
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">
              <a href="mailto:${email}" style="color: #14F7FF; text-decoration: none;">${email}</a>
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              📱 WhatsApp
            </p>
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">
              ${whatsapp}
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              🎯 Tipo de Competição
            </p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #37FF9F; line-height: 1.5;">
              ${forWhomLabel}
            </p>
          </div>

          <div>
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              📅 Data do Cadastro
            </p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #e0e0e0;">
              ${formatDate(createdAt)}
            </p>
          </div>
        </div>
      </div>

      <!-- Ação Rápida - WhatsApp -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          ⚡ Ação Rápida
        </p>
        <a href="${whatsappLink}" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(37, 211, 102, 0.3);">
          💬 ENTRAR EM CONTATO VIA WHATSAPP
        </a>
      </div>

      <!-- Acessar Plataforma -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="https://league.clipfyai.com/settings/leads" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.3);">
          📋 VER TODOS OS LEADS
        </a>
      </div>

      <!-- Informações -->
      <div style="background: rgba(55, 255, 159, 0.1); border: 1px solid #37FF9F; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #37FF9F;">
          💡 Lembre-se
        </p>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Este lead <strong style="color: #ffffff;">ainda está preenchendo o formulário</strong>
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Entre em contato <strong style="color: #ffffff;">o mais rápido possível</strong>
          </li>
          <li style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Acompanhe o progresso na <strong style="color: #ffffff;">página de leads</strong>
          </li>
        </ul>
      </div>

      <!-- Atribuição -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          🎯 Lead atribuído para você
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Este lead foi distribuído automaticamente para <strong style="color: #37FF9F;">${assignedTo}</strong>. Entre em contato o mais rápido possível!
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 24px 0; border-top: 1px solid #222222;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #888888;">
          Boa sorte com esse lead! 💪🚀
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #888888;">
          <strong style="color: #14F7FF;">ClipfyAI</strong> - Sua plataforma de competições de cortes
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

// Função para enviar email de notificação de novo lead
async function sendNewLeadNotificationEmail(
  leadId: string,
  fullName: string,
  email: string,
  whatsapp: string,
  forWhom: string,
  createdAt: Date
) {
  try {
    const assignedEmail = getRandomCommercialEmail();
    
    const { data, error } = await resend.emails.send({
      from: "Clipfy League <no-reply@clipfyai.com>",
      to: [assignedEmail],
      subject: `🔔 Novo Lead: ${fullName}`,
      html: getNewLeadNotificationEmailTemplate(
        leadId,
        fullName,
        email,
        whatsapp,
        forWhom,
        createdAt,
        assignedEmail
      ),
    });

    if (error) {
      console.error("Erro ao enviar email de novo lead:", error);
      return { success: false, error };
    }

    console.log(`Email de novo lead enviado para ${assignedEmail}:`, data);
    return { success: true, assignedTo: assignedEmail };
  } catch (error) {
    console.error("Erro ao enviar email de novo lead:", error);
    return { success: false, error };
  }
}

export const interestListRouter = createTRPCRouter({
  // Buscar todos os leads (apenas admin)
  getAll: adminProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CONVERTED", "ALL"]).optional(),
        urgency: z.enum(["IMMEDIATE", "SOON", "PLANNING", "EXPLORATORY", "ALL"]).optional(),
        budget: z.enum(["RANGE_50_80", "RANGE_80_200", "RANGE_200_500", "ABOVE_500", "NOT_DEFINED", "ALL"]).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {}
      
      if (input.status && input.status !== "ALL") {
        where.status = input.status
      }
      
      if (input.urgency && input.urgency !== "ALL") {
        where.urgency = input.urgency
      }
      
      if (input.budget && input.budget !== "ALL") {
        where.budget = input.budget
      }
      
      if (input.search) {
        where.OR = [
          { fullName: { contains: input.search, mode: "insensitive" as const } },
          { email: { contains: input.search, mode: "insensitive" as const } },
          { instagramHandle: { contains: input.search, mode: "insensitive" as const } },
        ]
      }

      const leads = await ctx.db.interestList.findMany({
        where,
        orderBy: { createdAt: "desc" },
      })

      return leads
    }),

  // Buscar estatísticas dos leads
  getStats: adminProcedure.query(async ({ ctx }) => {
    const [total, byStatus, byUrgency, byBudget] = await Promise.all([
      ctx.db.interestList.count(),
      ctx.db.interestList.groupBy({
        by: ["status"],
        _count: true,
      }),
      ctx.db.interestList.groupBy({
        by: ["urgency"],
        _count: true,
      }),
      ctx.db.interestList.groupBy({
        by: ["budget"],
        _count: true,
      }),
    ])

    return {
      total,
      byStatus: byStatus.reduce((acc, curr) => {
        acc[curr.status] = curr._count
        return acc
      }, {} as Record<string, number>),
      byUrgency: byUrgency.reduce((acc, curr) => {
        acc[curr.urgency] = curr._count
        return acc
      }, {} as Record<string, number>),
      byBudget: byBudget.reduce((acc, curr) => {
        acc[curr.budget] = curr._count
        return acc
      }, {} as Record<string, number>),
    }
  }),

  // Atualizar status de um lead
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["PENDING", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CONVERTED"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.interestList.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.notes && { notes: input.notes }),
        },
      })

      return lead
    }),

  // Deletar um lead
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.interestList.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),

  // Atualizar status de múltiplos leads em massa
  bulkUpdateStatus: adminProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1, "Selecione pelo menos 1 lead"),
        status: z.enum(["PENDING", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CONVERTED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.interestList.updateMany({
        where: { id: { in: input.ids } },
        data: { status: input.status },
      })

      return { success: true, count: input.ids.length }
    }),

  // ============================================================================
  // FLUXO DE CRIAÇÃO PROGRESSIVA (STEP BY STEP)
  // ============================================================================

  // Step 1: Criar lead inicial com informações de contato
  createInitial: publicProcedure
    .input(
      z.object({
        fullName: z.string()
          .min(10, "Nome completo deve ter pelo menos 10 caracteres")
          .max(80, "Nome completo deve ter no máximo 80 caracteres")
          .regex(/^\s*\S+(?:\s+\S+){1,}\s*$/, "Digite nome e sobrenome"),
        email: z.string()
          .email("E-mail inválido")
          .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "E-mail inválido"),
        whatsapp: z.string()
          .min(10, "WhatsApp inválido"),
        forWhom: z.enum(["MYSELF", "REPRESENTING_PERSON", "REPRESENTING_BRAND"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Criar registro inicial na lista de interesse
        const interestListEntry = await ctx.db.interestList.create({
          data: {
            fullName: input.fullName.trim(),
            email: input.email.toLowerCase().trim(),
            whatsapp: input.whatsapp.trim(),
            forWhom: input.forWhom,
            // Valores padrão para campos obrigatórios
            instagramHandle: "",
            objectives: "",
            urgency: "SOON",
            budget: "NOT_DEFINED",
            hasExperience: false,
            successMetrics: [],
            performanceLinks: [],
            agreeAuthority: false,
            agreePublicAnalysis: false,
            agreePrivacyAndTerms: false,
            status: "PENDING",
          },
        })

        // Enviar email de notificação para equipe comercial (não bloqueia a resposta)
        sendNewLeadNotificationEmail(
          interestListEntry.id,
          input.fullName.trim(),
          input.email.toLowerCase().trim(),
          input.whatsapp.trim(),
          input.forWhom,
          interestListEntry.createdAt
        ).catch(err => console.error("Erro ao enviar email de lead:", err))

        return {
          success: true,
          id: interestListEntry.id,
        }
      } catch (error: any) {
        console.error("Erro ao criar lead inicial:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar sua solicitação",
        })
      }
    }),

  // Step 1 (revisita): atualizar os dados de contato de um lead já criado.
  // Sem isso, voltar da etapa 2 para a 1 e avançar de novo criava um segundo
  // registro PENDING (e um segundo e-mail para o comercial), deixando o
  // primeiro lead órfão.
  updateContact: publicProcedure
    .input(
      z.object({
        id: z.string(),
        fullName: z.string()
          .min(10, "Nome completo deve ter pelo menos 10 caracteres")
          .max(80, "Nome completo deve ter no máximo 80 caracteres")
          .regex(/^\s*\S+(?:\s+\S+){1,}\s*$/, "Digite nome e sobrenome"),
        email: z.string()
          .email("E-mail inválido")
          .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "E-mail inválido"),
        whatsapp: z.string()
          .min(10, "WhatsApp inválido"),
        forWhom: z.enum(["MYSELF", "REPRESENTING_PERSON", "REPRESENTING_BRAND"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const lead = await ctx.db.interestList.update({
          where: { id: input.id },
          data: {
            fullName: input.fullName.trim(),
            email: input.email.toLowerCase().trim(),
            whatsapp: input.whatsapp.trim(),
            forWhom: input.forWhom,
          },
        })

        return {
          success: true,
          id: lead.id,
        }
      } catch (error: any) {
        console.error("Erro ao atualizar dados de contato do lead:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar sua solicitação",
        })
      }
    }),

  // Step 2: Atualizar redes sociais
  updateSocialMedia: publicProcedure
    .input(
      z.object({
        id: z.string(),
        instagramHandle: z.string()
          .min(2, "Instagram inválido")
          .max(30, "Instagram muito longo")
          .regex(/^@?[A-Za-z0-9._]{2,30}$/, "Handle do Instagram inválido"),
        tiktokHandle: z.string()
          .regex(/^@?[A-Za-z0-9._]{0,30}$/, "Handle do TikTok inválido")
          .optional()
          .nullable(),
        youtubeUrl: z.string()
          .optional()
          .nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Normalizar o Instagram handle (adicionar @ se não tiver)
        const normalizedInstagram = input.instagramHandle.startsWith('@') 
          ? input.instagramHandle 
          : `@${input.instagramHandle}`
        
        // Normalizar o TikTok handle se fornecido
        const normalizedTiktok = input.tiktokHandle && input.tiktokHandle.trim()
          ? input.tiktokHandle.startsWith('@')
            ? input.tiktokHandle
            : `@${input.tiktokHandle}`
          : null

        const lead = await ctx.db.interestList.update({
          where: { id: input.id },
          data: {
            instagramHandle: normalizedInstagram,
            tiktokHandle: normalizedTiktok,
            youtubeUrl: input.youtubeUrl || null,
          },
        })

        return { success: true, id: lead.id }
      } catch (error: any) {
        console.error("Erro ao atualizar redes sociais:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar sua solicitação",
        })
      }
    }),

  // Step 3: Atualizar objetivos, urgência e orçamento
  updateObjectives: publicProcedure
    .input(
      z.object({
        id: z.string(),
        objectives: z.string()
          .min(50, "Objetivos devem ter pelo menos 50 caracteres")
          .max(400, "Objetivos devem ter no máximo 400 caracteres"),
        urgency: z.enum(["IMMEDIATE", "SOON", "PLANNING", "EXPLORATORY"]),
        budget: z.enum(["RANGE_50_80", "RANGE_80_200", "RANGE_200_500", "ABOVE_500", "NOT_DEFINED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const lead = await ctx.db.interestList.update({
          where: { id: input.id },
          data: {
            objectives: input.objectives.trim(),
            urgency: input.urgency,
            budget: input.budget,
          },
        })

        return { success: true, id: lead.id }
      } catch (error: any) {
        console.error("Erro ao atualizar objetivos:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar sua solicitação",
        })
      }
    }),

  // Step 4: Atualizar experiência e métricas
  updateExperience: publicProcedure
    .input(
      z.object({
        id: z.string(),
        hasExperience: z.boolean().optional().default(false),
        experienceFeedback: z.string()
          .max(300, "Feedback deve ter no máximo 300 caracteres")
          .optional()
          .nullable(),
        successMetrics: z.array(z.string()).min(1, "Selecione pelo menos 1 métrica").max(3, "Máximo de 3 métricas"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const lead = await ctx.db.interestList.update({
          where: { id: input.id },
          data: {
            hasExperience: input.hasExperience,
            experienceFeedback: input.experienceFeedback?.trim() || null,
            successMetrics: input.successMetrics,
          },
        })

        return { success: true, id: lead.id }
      } catch (error: any) {
        console.error("Erro ao atualizar experiência:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar sua solicitação",
        })
      }
    }),

  // Step 5: Finalizar com comentários e consentimentos
  completeLead: publicProcedure
    .input(
      z.object({
        id: z.string(),
        additionalComments: z.string()
          .max(800, "Comentários devem ter no máximo 800 caracteres")
          .optional()
          .nullable(),
        agreeAuthority: z.boolean().refine(val => val === true, "Você deve confirmar que tem poderes para contratar"),
        agreePublicAnalysis: z.boolean().refine(val => val === true, "Você deve autorizar a análise pública"),
        agreePrivacyAndTerms: z.boolean().refine(val => val === true, "Você deve concordar com a Política de Privacidade"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const lead = await ctx.db.interestList.update({
          where: { id: input.id },
          data: {
            additionalComments: input.additionalComments?.trim() || null,
            agreeAuthority: input.agreeAuthority,
            agreePublicAnalysis: input.agreePublicAnalysis,
            agreePrivacyAndTerms: input.agreePrivacyAndTerms,
          },
        })

        return {
          success: true,
          message: "Obrigado! Sua solicitação foi enviada com sucesso. Entraremos em contato em breve.",
          id: lead.id,
        }
      } catch (error: any) {
        console.error("Erro ao finalizar lead:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar sua solicitação",
        })
      }
    }),

  // ============================================================================
  // CRIAÇÃO COMPLETA (LEGADO - mantido para compatibilidade)
  // ============================================================================

  create: publicProcedure
    .input(
      z.object({
        // 1-3. Informações de contato
        fullName: z.string()
          .min(10, "Nome completo deve ter pelo menos 10 caracteres")
          .max(80, "Nome completo deve ter no máximo 80 caracteres")
          .regex(/^\s*\S+(?:\s+\S+){1,}\s*$/, "Digite nome e sobrenome"),
        email: z.string()
          .email("E-mail inválido")
          .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "E-mail inválido"),
        whatsapp: z.string()
          .min(10, "WhatsApp inválido"),
        
        // 4. Para quem é a competição
        forWhom: z.enum(["MYSELF", "REPRESENTING_PERSON", "REPRESENTING_BRAND"]),
        
        // 5-7. Redes sociais
        instagramHandle: z.string()
          .min(2, "Instagram inválido")
          .max(30, "Instagram muito longo")
          .regex(/^@?[A-Za-z0-9._]{2,30}$/, "Handle do Instagram inválido"),
        tiktokHandle: z.string()
          .regex(/^@?[A-Za-z0-9._]{0,30}$/, "Handle do TikTok inválido")
          .optional()
          .nullable(),
        youtubeUrl: z.string()
          .optional()
          .nullable(),
        
        // 8. Objetivos
        objectives: z.string()
          .min(50, "Objetivos devem ter pelo menos 50 caracteres")
          .max(400, "Objetivos devem ter no máximo 400 caracteres"),
        
        // 10. Urgência
        urgency: z.enum(["IMMEDIATE", "SOON", "PLANNING", "EXPLORATORY"]),
        
        // 11. Orçamento
        budget: z.enum(["RANGE_50_80", "RANGE_80_200", "RANGE_200_500", "ABOVE_500", "NOT_DEFINED"]),
        
        // 12. Experiência prévia (opcional)
        hasExperience: z.boolean().optional().default(false),
        experienceFeedback: z.string()
          .max(300, "Feedback deve ter no máximo 300 caracteres")
          .optional()
          .nullable(),
        
        // 13. Métricas de sucesso
        successMetrics: z.array(z.string()).min(1, "Selecione pelo menos 1 métrica").max(3, "Máximo de 3 métricas"),
        
        // 14. Comentários adicionais
        additionalComments: z.string()
          .max(800, "Comentários devem ter no máximo 800 caracteres")
          .optional()
          .nullable(),
        
        // 15. Consentimentos
        agreeAuthority: z.boolean().refine(val => val === true, "Você deve confirmar que tem poderes para contratar"),
        agreePublicAnalysis: z.boolean().refine(val => val === true, "Você deve autorizar a análise pública"),
        agreePrivacyAndTerms: z.boolean().refine(val => val === true, "Você deve concordar com a Política de Privacidade"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Normalizar o Instagram handle (adicionar @ se não tiver)
        const normalizedInstagram = input.instagramHandle.startsWith('@') 
          ? input.instagramHandle 
          : `@${input.instagramHandle}`
        
        // Normalizar o TikTok handle se fornecido
        const normalizedTiktok = input.tiktokHandle && input.tiktokHandle.trim()
          ? input.tiktokHandle.startsWith('@')
            ? input.tiktokHandle
            : `@${input.tiktokHandle}`
          : null

        // Criar registro na lista de interesse
        const interestListEntry = await ctx.db.interestList.create({
          data: {
            fullName: input.fullName.trim(),
            email: input.email.toLowerCase().trim(),
            whatsapp: input.whatsapp.trim(),
            forWhom: input.forWhom,
            instagramHandle: normalizedInstagram,
            tiktokHandle: normalizedTiktok,
            youtubeUrl: input.youtubeUrl || null,
            performanceLinks: [],
            objectives: input.objectives.trim(),
            urgency: input.urgency,
            budget: input.budget,
            hasExperience: input.hasExperience,
            experienceFeedback: input.experienceFeedback?.trim() || null,
            successMetrics: input.successMetrics,
            additionalComments: input.additionalComments?.trim() || null,
            agreeAuthority: input.agreeAuthority,
            agreePublicAnalysis: input.agreePublicAnalysis,
            agreePrivacyAndTerms: input.agreePrivacyAndTerms,
            status: "PENDING",
          },
        })

        return {
          success: true,
          message: "Obrigado! Sua solicitação foi enviada com sucesso. Entraremos em contato em breve.",
          id: interestListEntry.id,
        }
      } catch (error: any) {
        console.error("Erro ao criar entrada na lista de interesse:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar sua solicitação",
        })
      }
    }),
})
