import type { OllamaToolCall } from "@/lib/assistant-tools";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiChatResponse = {
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
};

export type AiChatStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_calls"; tool_calls: OllamaToolCall[] }
  | { type: "done" }
  | { type: "error"; message: string };

const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";

export async function callGroqChat(input: {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  tools?: unknown[];
}): Promise<AiChatResponse> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: false,
  };
  if (input.tools && input.tools.length > 0) body.tools = input.tools;

  const res = await fetch(GROQ_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    signal: input.signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = await res.json() as {
    choices: { message: { role: string; content: string; tool_calls?: OllamaToolCall[] } }[];
  };

  return { message: json.choices[0]!.message };
}

function parseSseLine(line: string): AiChatStreamEvent | null {
  if (!line.startsWith("data: ")) return null;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return { type: "done" };

  try {
    const parsed = JSON.parse(payload) as {
      choices?: { delta: { content?: string; tool_calls?: OllamaToolCall[] }; finish_reason?: string }[];
    };
    const choice = parsed.choices?.[0];
    if (!choice) return null;

    if (choice.delta?.content) {
      return { type: "text", content: choice.delta.content };
    }

    if (choice.delta?.tool_calls && choice.delta.tool_calls.length > 0) {
      return { type: "tool_calls", tool_calls: choice.delta.tool_calls };
    }

    if (choice.finish_reason) {
      return { type: "done" };
    }

    return null;
  } catch {
    return { type: "error", message: `SSE parse error: ${payload.slice(0, 200)}` };
  }
}

export async function* streamGroqChat(input: {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  tools?: unknown[];
}): AsyncGenerator<AiChatStreamEvent> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: true,
  };
  if (input.tools && input.tools.length > 0) body.tools = input.tools;

  const res = await fetch(GROQ_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    signal: input.signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    yield { type: "error", message: `Groq HTTP ${res.status}: ${text.slice(0, 400)}` };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: "error", message: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const event = parseSseLine(trimmed);
        if (event) yield event;
      }
    }

    if (buffer.trim()) {
      const event = parseSseLine(buffer.trim());
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
