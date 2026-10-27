// The HTTP APIs the console reads, each with its bearer token: the foremen's, intake's and gatekeeper's (ADR 0072).
// An answer other than 200, or none, is a note that names the API, never an exception.

export interface Api {
  name: string;
  url: string;
  token?: string;
}

export type Answer<T> = { ok: true; body: T } | { ok: false; status: number; note: string };

export async function getJson<T>(api: Api, path: string): Promise<Answer<T>> {
  const headers: Record<string, string> = api.token ? { authorization: `Bearer ${api.token}` } : {};
  try {
    const response = await fetch(`${api.url.replace(/\/$/, "")}${path}`, { headers });
    if (response.ok) return { ok: true, body: (await response.json()) as T };
    return {
      ok: false,
      status: response.status,
      note: `the ${api.name} at ${api.url} did not answer: ${response.status}`,
    };
  } catch {
    return { ok: false, status: 0, note: `the ${api.name} at ${api.url} did not answer` };
  }
}
