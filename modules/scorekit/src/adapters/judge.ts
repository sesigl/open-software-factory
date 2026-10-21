// The judge call: one OpenAI-compatible chat completion per run.
import type { Message } from "../domain/judge.ts";

export interface Answer {
  text: string;
  model: string;
  usage?: { input: number; output: number };
}

export class JudgeError extends Error {
  override name = "JudgeError";
}

export async function askJudge(
  gateway: { url: string; key?: string },
  model: string,
  messages: Message[],
): Promise<Answer> {
  const response = await fetch(`${gateway.url.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(gateway.key ? { authorization: `Bearer ${gateway.key}` } : {}),
    },
    body: JSON.stringify({ model, temperature: 0, messages }),
  });
  if (!response.ok) throw new JudgeError(`the judge call failed with HTTP ${response.status}`);
  const body = (await response.json().catch(() => ({}))) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const usage = body.usage;
  return {
    text: body.choices?.[0]?.message?.content ?? "",
    model: body.model ?? model,
    usage: usage ? { input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0 } : undefined,
  };
}
