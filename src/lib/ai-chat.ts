import type { OllamaToolCall } from "@/lib/assistant-tools";
import { aiChatRpc } from "@/lib/server-rpc";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiChatStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_calls"; tool_calls: OllamaToolCall[] }
  | { type: "done"; content: string; tool_calls: OllamaToolCall[] }
  | { type: "error"; message: string };

export async function* streamAiChat(input: {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  signal?: AbortSignal;
}): AsyncGenerator<AiChatStreamEvent> {
  try {
    if (input.signal?.aborted) return;

    const result = await aiChatRpc({
      data: {
        model: input.model,
        messages: input.messages,
        tools: input.tools,
      },
    });

    if (input.signal?.aborted) return;

    if (result.content) {
      yield { type: "text", content: result.content };
    }

    const toolCalls = (result.tool_calls ?? []) as OllamaToolCall[];
    if (toolCalls.length > 0) {
      yield { type: "tool_calls", tool_calls: toolCalls };
    }

    yield { type: "done", content: result.content ?? "", tool_calls: toolCalls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    yield { type: "error", message };
  }
}
