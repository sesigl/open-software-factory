// The HTTP APIs the console reads, each with its bearer token: the foremen's, intake's and gatekeeper's (ADR 0072).
// An answer other than 2xx, or none, is a note that names the API, never an exception.

export interface Api {
  name: string;
  url: string;
  token?: string;
}

export type Answer<T> = { ok: true; body: T } | { ok: false; status: number; note: string };

const urlOf = (api: Api, path: string) => `${api.url.replace(/\/$/, "")}${path}`;
const auth = (api: Api): Record<string, string> => (api.token ? { authorization: `Bearer ${api.token}` } : {});

async function request<T>(api: Api, path: string, init: { method?: string; body?: string } = {}): Promise<Answer<T>> {
  const headers = { ...auth(api), ...(init.body ? { "content-type": "application/json" } : {}) };
  try {
    const response = await fetch(urlOf(api, path), { ...init, headers });
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

export const getJson = <T>(api: Api, path: string) => request<T>(api, path);

/** POSTs the JSON body to the API with its token. */
export const postJson = <T>(api: Api, path: string, body: unknown) =>
  request<T>(api, path, { method: "POST", body: JSON.stringify(body) });

/** The status and JSON body of GET `path`; status 0 when nothing answers. */
export async function probe(api: Api, path: string): Promise<{ status: number; body?: unknown }> {
  try {
    const response = await fetch(urlOf(api, path), {
      headers: auth(api),
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json().catch(() => undefined) };
  } catch {
    return { status: 0 };
  }
}
