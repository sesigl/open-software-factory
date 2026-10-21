// Langfuse's score API: POST /api/public/scores with basic auth. Langfuse keeps one score per ID.
import type { Score } from "@opensoftware/contracts";

export async function pushScore(
  langfuse: { host: string; publicKey: string; secretKey: string },
  score: Score,
): Promise<string | undefined> {
  const auth = Buffer.from(`${langfuse.publicKey}:${langfuse.secretKey}`).toString("base64");
  const response = await fetch(`${langfuse.host.replace(/\/+$/, "")}/api/public/scores`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: JSON.stringify(score),
  });
  return response.ok ? undefined : `Langfuse answered HTTP ${response.status}`;
}
