// The Factory MCP server's way to the inbox: the HTTP API of "intake serve" with its token (ADR 0063).

export interface Answer {
  status: number;
  body: unknown;
}

export interface Api {
  submit(submission: unknown): Promise<Answer>;
  workItem(id: string): Promise<Answer>;
}

export function intakeApi(base: string, token: string): Api {
  const call = async (path: string, init: RequestInit = {}): Promise<Answer> => {
    const response = await fetch(new URL(path, base), {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as unknown) : undefined };
  };
  return {
    submit: (submission) => call("/v1/work-items", { method: "POST", body: JSON.stringify(submission) }),
    workItem: (id) => call(`/v1/work-items/${encodeURIComponent(id)}`),
  };
}
