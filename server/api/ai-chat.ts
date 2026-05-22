export default defineEventHandler(async (event) => {
  const body = await readBody<{
    model?: string;
    messages: { role: string; content: string }[];
    tools?: unknown[];
  }>(event);

  if (!body?.messages?.length) {
    throw createError({ statusCode: 400, statusMessage: "messages required" });
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: body.model || "llama-3.3-70b-versatile",
      messages: body.messages,
      tools: body.tools?.length ? body.tools : undefined,
      stream: true,
    }),
  });

  if (!groqRes.ok) {
    const text = await groqRes.text().catch(() => "");
    throw createError({
      statusCode: groqRes.status,
      statusMessage: `Groq API error: ${text.slice(0, 500)}`,
    });
  }

  return new Response(groqRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
