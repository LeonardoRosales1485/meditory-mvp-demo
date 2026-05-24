export default defineEventHandler(async (event) => {
  const body = await readBody<{
    model?: string;
    messages: { role: string; content: string }[];
    tools?: unknown[];
  }>(event);

  if (!body?.messages?.length) {
    throw createError({ statusCode: 400, statusMessage: "messages required" });
  }

  const baseUrl = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
  const apiKey = process.env.LLM_API_KEY;
  const defaultModel = process.env.LLM_MODEL ?? "llama3.1:8b";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: body.model || defaultModel,
      messages: body.messages,
      tools: body.tools?.length ? body.tools : undefined,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw createError({
      statusCode: res.status,
      statusMessage: `LLM API error: ${text.slice(0, 500)}`,
    });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
