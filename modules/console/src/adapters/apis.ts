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

/** The status and JSON body of GET `path`, with the API's token unless `anonymous`; status 0 when nothing answers. */
export async function probe(api: Api, path: string, anonymous = false): Promise<{ status: number; body?: unknown }> {
  const headers: Record<string, string> = api.token && !anonymous ? { authorization: `Bearer ${api.token}` } : {};
  try {
    const response = await fetch(`${api.url.replace(/\/$/, "")}${path}`, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  } catch {
    return { status: 0 };
  }
}

/** POSTs the JSON body to the API with its token; an answer other than 2xx, or none, is a note that names the API. */
export async function postJson<T>(api: Api, path: string, body: unknown): Promise<Answer<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(api.token ? { authorization: `Bearer ${api.token}` } : {}),
  };
  try {
    const response = await fetch(`${api.url.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true, body: (await response.json()) as T };
    return { ok: false, status: response.status, note: `the ${api.name} at ${api.url} refused it: ${response.status}` };
  } catch {
    return { ok: false, status: 0, note: `the ${api.name} at ${api.url} did not answer` };
  }
}
