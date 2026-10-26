// The Factory MCP server's way to the inbox and to the runs: the HTTP APIs of "intake serve" (ADR 0063) and of
// "foreman serve" (ADR 0071), each with its token.

export interface Answer {
  status: number;
  body: unknown;
}

export interface Api {
  submit(submission: unknown): Promise<Answer>;
  workItem(id: string): Promise<Answer>;
}

/** GET or POST a path of the API at `base` with the token; the answer's status and JSON. */
function caller(base: string, token: string) {
  return async (path: string, init: RequestInit = {}): Promise<Answer> => {
    const response = await fetch(new URL(path, base), {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as unknown) : undefined };
  };
}

export function intakeApi(base: string, token: string): Api {
  const call = caller(base, token);
  return {
    submit: (submission) => call("/v1/work-items", { method: "POST", body: JSON.stringify(submission) }),
    workItem: (id) => call(`/v1/work-items/${encodeURIComponent(id)}`),
  };
}

/** The view of a run from the foreman's API. */
export const foremanRun = (base: string, token: string, runId: string): Promise<Answer> =>
  caller(base, token)(`/v1/runs/${encodeURIComponent(runId)}`);
