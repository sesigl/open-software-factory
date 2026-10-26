// gatekeeper's API (ADR 0048): the foreman asks for a decision before a stage with a gate starts (ADR 0067).
import type { GateRequest, GateView } from "@opensoftware/contracts";

export interface Gatekeeper {
  /** The gate gatekeeper made for the request, or the one the same request made before. */
  request(request: GateRequest): Promise<GateView>;
}

export function gatekeeper(url: string | undefined, token: string | undefined): Gatekeeper {
  return {
    async request(request) {
      if (!url) throw new Error("set FOREMAN_GATEKEEPER_URL: a stage has a gate");
      const response = await fetch(new URL("/v1/gates", url), {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(request),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`gatekeeper answered ${response.status} to the gate request: ${body}`);
      return JSON.parse(body) as GateView;
    },
  };
}
