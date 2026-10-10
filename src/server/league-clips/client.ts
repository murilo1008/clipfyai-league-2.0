import "server-only";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "@/env";
import { leagueError } from "./errors";
import { clientMockMode } from "./availability";
import { schemaIssuePaths } from "./schema-issues";
import { mockCall, MockClipsError } from "./mock";
import {
  brandKitSchema,
  logoUploadSchema,
  clipSchema,
  creditsSchema,
  ledgerEntrySchema,
  projectSchema,
  renderSchema,
  templateSchema,
  transcriptSchema,
  uploadCreatedSchema,
  uploadPartsSchema,
  uploadStateSchema,
  type ProjectOptionsInput,
} from "./contracts";

const prefix = "/api/v1/league-clips";
async function call<S extends z.ZodTypeAny>(
  method: string,
  path: string,
  userId: string,
  schema: S,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<z.infer<S>> {
  const mockMode = clientMockMode(process.env.NODE_ENV, env.LEAGUE_CLIPS_MOCK);
  if (mockMode === "blocked")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Modo mock indisponível em produção.",
    });
  if (mockMode === "mock") {
    try {
      return schema.parse(mockCall(method, path, userId, body, headers));
    } catch (error) {
      if (error instanceof MockClipsError)
        throw leagueError(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      throw error;
    }
  }
  const key = env.LEAGUE_INTERNAL_API_KEY?.trim();
  if (!key)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI Clips indisponível: chave do League não configurada.",
    });
  const url = new URL(prefix + path, env.LEAGUE_API_URL);
  if (method === "GET" || method === "DELETE")
    url.searchParams.set("userId", userId);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": key,
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : JSON.stringify({ ...(body as object), userId }),
    });
  } catch {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Não foi possível conectar ao League. Tente novamente.",
    });
  }
  if (response.status === 204) return schema.parse(null);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw leagueError(response.status, data);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(
      "League AI Clips: caminhos inválidos na resposta",
      schemaIssuePaths(parsed.error),
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Resposta inesperada do League para AI Clips.",
    });
  }
  return parsed.data;
}
const id = (value: string) => encodeURIComponent(value);
export const leagueClips = {
  brandKits: (userId: string) =>
    call(
      "GET",
      "/brand-kits",
      userId,
      z.object({ items: z.array(brandKitSchema) }),
    ),
  brandKit: (userId: string, kitId: string) =>
    call("GET", "/brand-kits/" + id(kitId), userId, brandKitSchema),
  createBrandKit: (userId: string, input: unknown) =>
    call("POST", "/brand-kits", userId, brandKitSchema, input),
  patchBrandKit: (
    userId: string,
    kitId: string,
    version: number,
    patch: unknown,
  ) =>
    call("PATCH", "/brand-kits/" + id(kitId), userId, brandKitSchema, patch, {
      "If-Match": String(version),
    }),
  deleteBrandKit: (userId: string, kitId: string) =>
    call("DELETE", "/brand-kits/" + id(kitId), userId, z.null()),
  setDefaultBrandKit: (userId: string, kitId: string) =>
    call(
      "POST",
      "/brand-kits/" + id(kitId) + "/default",
      userId,
      brandKitSchema,
      {},
    ),
  logoUpload: (
    userId: string,
    kitId: string,
    contentType: string,
    sizeBytes: number,
  ) =>
    call(
      "POST",
      "/brand-kits/" + id(kitId) + "/logo/upload",
      userId,
      logoUploadSchema,
      { contentType, sizeBytes },
    ),
  attachLogo: (
    userId: string,
    kitId: string,
    version: number,
    uploadKey: string,
  ) =>
    call(
      "POST",
      "/brand-kits/" + id(kitId) + "/logo",
      userId,
      brandKitSchema,
      { uploadKey },
      { "If-Match": String(version) },
    ),
  removeLogo: (userId: string, kitId: string, version: number) =>
    call(
      "DELETE",
      "/brand-kits/" + id(kitId) + "/logo",
      userId,
      brandKitSchema,
      undefined,
      { "If-Match": String(version) },
    ),
  list: (
    userId: string,
    input: { cursor?: string; limit: number; status?: string },
  ) =>
    call(
      "GET",
      "/projects?" +
        new URLSearchParams(
          Object.entries(input)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString(),
      userId,
      z.object({
        items: z.array(projectSchema),
        nextCursor: z.string().nullable(),
      }),
    ),
  project: (userId: string, projectId: string) =>
    call("GET", "/projects/" + id(projectId), userId, projectSchema),
  create: (
    userId: string,
    input: {
      url: string;
      options?: ProjectOptionsInput;
      idempotencyKey: string;
    },
  ) =>
    call(
      "POST",
      "/projects",
      userId,
      projectSchema,
      { source: { type: "url", url: input.url }, options: input.options },
      { "Idempotency-Key": input.idempotencyKey },
    ),
  cancel: (userId: string, projectId: string) =>
    call(
      "POST",
      "/projects/" + id(projectId) + "/cancel",
      userId,
      projectSchema,
      {},
    ),
  delete: (userId: string, projectId: string) =>
    call("DELETE", "/projects/" + id(projectId), userId, z.null()),
  clips: (userId: string, projectId: string) =>
    call(
      "GET",
      "/projects/" + id(projectId) + "/clips",
      userId,
      z.array(clipSchema),
    ),
  clip: (userId: string, clipId: string) =>
    call("GET", "/clips/" + id(clipId), userId, clipSchema),
  transcript: (userId: string, clipId: string) =>
    call(
      "GET",
      "/clips/" + id(clipId) + "/transcript",
      userId,
      transcriptSchema,
    ),
  patch: (userId: string, clipId: string, version: number, changes: unknown) =>
    call("PATCH", "/clips/" + id(clipId), userId, clipSchema, changes, {
      "If-Match": String(version),
    }),
  render: (userId: string, clipId: string, aspectRatios?: ("9:16" | "1:1")[]) =>
    call(
      "POST",
      "/clips/" + id(clipId) + "/render",
      userId,
      z.object({
        renders: z.array(renderSchema),
        clipVersion: z.number().int(),
      }),
      { aspectRatios },
    ),
  exportClip: (
    userId: string,
    clipId: string,
    aspectRatios?: ("9:16" | "1:1")[],
  ) =>
    call(
      "POST",
      "/clips/" + id(clipId) + "/export",
      userId,
      z.object({
        renders: z.array(renderSchema),
        clipVersion: z.number().int(),
      }),
      { aspectRatios },
    ),
  templates: (userId: string) =>
    call("GET", "/caption-templates", userId, z.array(templateSchema)),
  credits: (userId: string) => call("GET", "/credits", userId, creditsSchema),
  ledger: (userId: string, cursor?: string) =>
    call(
      "GET",
      "/credits/ledger" +
        (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      userId,
      z.object({
        items: z.array(ledgerEntrySchema),
        nextCursor: z.string().nullable(),
      }),
    ),
  createUpload: (userId: string, input: unknown) =>
    call("POST", "/uploads", userId, uploadCreatedSchema, input),
  upload: (userId: string, uploadId: string) =>
    call("GET", "/uploads/" + id(uploadId), userId, uploadStateSchema),
  uploadParts: (userId: string, uploadId: string, partNumbers: number[]) =>
    call(
      "POST",
      "/uploads/" + id(uploadId) + "/parts",
      userId,
      uploadPartsSchema,
      { partNumbers },
    ),
  completeUpload: (
    userId: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ) =>
    call(
      "POST",
      "/uploads/" + id(uploadId) + "/complete",
      userId,
      projectSchema,
      { parts },
    ),
  abortUpload: (userId: string, uploadId: string) =>
    call("DELETE", "/uploads/" + id(uploadId), userId, z.null()),
};
