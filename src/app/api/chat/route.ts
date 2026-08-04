import { auth } from "@clerk/nextjs/server"
import { db } from "@/server/db"
import OpenAI from "openai"
import { env } from "@/env"
import {
  SYSTEM_PROMPT,
  TOOLS,
  executeTool,
} from "@/server/api/routers/chat"
import type { ResponseInputItem } from "openai/resources/responses/responses"

export const maxDuration = 120

const MAX_ITERATIONS = 10

function sanitizeOutput(text: string): string {
  let result = text
  result = result.replace(/to=functions\.\w+[^\n]*/g, "")
  result = result.replace(/to=multi_tool_use\.\w+[^\n]*/g, "")
  result = result.replace(/\{"recipient_name"\s*:\s*"functions\.[^}]*\}/g, "")
  result = result.replace(/\{"tool_uses"\s*:\s*\[.*?\]\s*\}/gs, "")
  result = result.replace(/\{"(campaignId|model|operation)"[^}]*\}/g, "")
  result = result.replace(/[^\n]*[\u4e00-\u9fff\u3400-\u4dbf]{2,}[^\n]*/g, "")
  result = result.replace(/\n{3,}/g, "\n\n")
  return result.trim()
}

/**
 * Converts Chat Completions message history to the Responses API input format
 * so we can use reasoning + summary in Phase 2.
 */
function toResponsesInput(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): ResponseInputItem[] {
  const items: ResponseInputItem[] = []

  for (const msg of messages) {
    if (msg.role === "system") {
      items.push({
        role: "system",
        content: typeof msg.content === "string" ? msg.content : "",
      })
    } else if (msg.role === "user") {
      items.push({
        role: "user",
        content: typeof msg.content === "string" ? msg.content : "",
      })
    } else if (msg.role === "assistant") {
      const assistantMsg =
        msg as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        for (const tc of assistantMsg.tool_calls) {
          if (tc.type !== "function") continue
          items.push({
            type: "function_call",
            name: tc.function.name,
            arguments: tc.function.arguments,
            call_id: tc.id,
          })
        }
      } else if (assistantMsg.content) {
        items.push({
          role: "assistant",
          content:
            typeof assistantMsg.content === "string"
              ? assistantMsg.content
              : "",
        })
      }
    } else if (msg.role === "tool") {
      const toolMsg =
        msg as OpenAI.Chat.Completions.ChatCompletionToolMessageParam
      items.push({
        type: "function_call_output",
        call_id: toolMsg.tool_call_id,
        output: typeof toolMsg.content === "string" ? toolMsg.content : "",
      })
    }
  }

  return items
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user?.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 })
  }

  const body = (await req.json()) as {
    messages: { role: string; content: string }[]
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        )
      }

      try {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...body.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ]

        let iterations = 0
        let totalToolCalls = 0
        const toolsUsed: string[] = []

        // ─── PHASE 1: Tool-calling loop (Chat Completions, no reasoning) ───
        while (iterations < MAX_ITERATIONS) {
          iterations++

          const response = await openai.chat.completions.create({
            model: "gpt-5.4",
            messages,
            tools: TOOLS,
            temperature: 1,
            max_completion_tokens: 8192,
          })

          const choice = response.choices[0]!
          const assistantMsg = choice.message

          if (
            assistantMsg.tool_calls &&
            assistantMsg.tool_calls.length > 0
          ) {
            const fnCalls = assistantMsg.tool_calls.filter(
              (tc): tc is Extract<typeof tc, { type: "function" }> =>
                tc.type === "function",
            )

            messages.push({
              role: "assistant",
              content: null,
              tool_calls: fnCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              })),
            })

            for (const tc of fnCalls) {
              totalToolCalls++
              toolsUsed.push(tc.function.name)
              send({ type: "tool", name: tc.function.name })

              try {
                const args = JSON.parse(tc.function.arguments) as Record<
                  string,
                  unknown
                >
                const result = await executeTool(
                  db as any,
                  tc.function.name,
                  args,
                )
                messages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: JSON.stringify(result),
                })
              } catch {
                messages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: JSON.stringify({
                    error: "Falha ao executar ferramenta",
                  }),
                })
              }
            }
          } else {
            break
          }
        }

        // ─── PHASE 2: Final response (Responses API + reasoning summary + streaming) ───
        const responsesInput = toResponsesInput(messages)

        const responsesStream = await openai.responses.create({
          model: "gpt-5.4",
          input: responsesInput,
          reasoning: { effort: "high", summary: "auto" },
          temperature: 1,
          max_output_tokens: 16384,
          stream: true,
        })

        let rawContent = ""
        let thinkingDone = false

        for await (const event of responsesStream) {
          if (event.type === "response.reasoning_summary_text.delta") {
            send({ type: "thinking", content: event.delta })
          } else if (event.type === "response.output_text.delta") {
            if (!thinkingDone) {
              thinkingDone = true
              send({ type: "thinking_done" })
            }
            rawContent += event.delta
            send({ type: "chunk", content: event.delta })
          }
        }

        const cleanContent = sanitizeOutput(rawContent)

        send({
          type: "done",
          content: cleanContent,
          toolCalls: totalToolCalls,
          toolsUsed: [...new Set(toolsUsed)],
        })
        controller.close()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro interno do servidor"
        send({ type: "error", message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
