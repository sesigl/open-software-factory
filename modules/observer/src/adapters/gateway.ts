// The model call: one OpenAI-compatible chat completion at temperature 0.
export async function complete(
  gateway: { url: string; key: string | undefined },
  model: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const response = await fetch(`${gateway.url.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(gateway.key && { authorization: `Bearer ${gateway.key}` }) },
    body: JSON.stringify({ model, temperature: 0, messages }),
  });
  if (!response.ok) throw new Error(`the model gateway answered HTTP ${response.status}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? "";
}
