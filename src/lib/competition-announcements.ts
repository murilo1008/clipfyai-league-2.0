import { z } from "zod";

export const announcementCategorySchema = z.enum([
  "CONTENT",
  "RULES",
  "NOTICE",
  "GUIDANCE",
  "CLIPFY_NOTICE",
]);

export type AnnouncementCategory = z.infer<typeof announcementCategorySchema>;

export const ANNOUNCEMENT_CATEGORIES: Record<
  AnnouncementCategory,
  { label: string; emoji: string; className: string }
> = {
  CONTENT: {
    label: "Conteúdos da competição",
    emoji: "📌",
    className:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  RULES: {
    label: "Regras",
    emoji: "📋",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  NOTICE: {
    label: "Avisos",
    emoji: "📢",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  GUIDANCE: {
    label: "Direcionamentos específicos",
    emoji: "🎯",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  CLIPFY_NOTICE: {
    label: "Avisos gerais da Clipfy",
    emoji: "ℹ️",
    className:
      "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
};

export const announcementFieldsSchema = z.object({
  category: announcementCategorySchema,
  recipientClipperProfileId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1, "Informe o título").max(200),
  content: z.string().trim().min(1, "Informe a mensagem").max(20000),
  linkUrl: z
    .string()
    .trim()
    .max(2048)
    .url("Informe um link válido")
    .refine((url) => /^https?:\/\//i.test(url), "Use um link HTTP ou HTTPS")
    .nullable()
    .optional(),
});

export function validateAnnouncementRecipient(
  input: {
    category: AnnouncementCategory;
    recipientClipperProfileId?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (input.category === "GUIDANCE" && !input.recipientClipperProfileId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recipientClipperProfileId"],
      message: "Selecione o clipador que receberá o direcionamento.",
    });
  } else if (input.category !== "GUIDANCE" && input.recipientClipperProfileId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recipientClipperProfileId"],
      message:
        "Somente direcionamentos específicos podem ter um destinatário individual.",
    });
  }
}

export const announcementDraftSchema = announcementFieldsSchema.superRefine(
  validateAnnouncementRecipient,
);

export type AnnouncementPost = {
  id: string;
  category: AnnouncementCategory;
  title: string;
  content: string;
  linkUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  isUnread?: boolean;
};
