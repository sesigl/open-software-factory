// LiteLLM's admin API on the gateway's published port, called with the gateway's master key.

export interface Gateway {
  /** The gateway's address on this host, such as http://127.0.0.1:32768. */
  origin: string;
  masterKey: string;
}

/** Calls the admin API; an answer other than 2xx rejects with LiteLLM's message. */
export async function admin(gateway: Gateway, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${gateway.origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${gateway.masterKey}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`LiteLLM answered ${path} with ${response.status}: ${text}`);
  return JSON.parse(text);
}

/** Whether the proxy is up and connected to its database. */
export async function ready(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/health/readiness`);
    return response.ok && ((await response.json()) as { db?: string }).db === "connected";
  } catch {
    return false;
  }
}
