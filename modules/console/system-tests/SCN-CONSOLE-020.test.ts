import type { GateView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { foreman, open, RUN, rows, runOf, serving } from "./console.ts";

const GATE = "g0123456789abcdef";

scenario("SCN-CONSOLE-020", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  let gatekeeper: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a foreman with a run whose stage "ship" waits at the gate "g0123456789abcdef", and gatekeeper whose gate is "pending" for "leads"',
    async () => {
      api = await foreman(fakes, [
        runOf("Export reports as CSV", {
          state: "blocked",
          stages: [
            { stage: "plan", agent: "planner", state: "succeeded" },
            { stage: "ship", agent: "shipper", state: "blocked", gateId: GATE },
          ],
        }),
      ]);
      const gate: GateView = {
        id: GATE,
        workItem: "wi_0123456789abcdef0123",
        stage: "ship",
        summary: "Ship the CSV export",
        approvers: ["leads"],
        channel: "slack:C0GATES",
        state: "pending",
        waitingFor: ["leads"],
        requestedAt: "2025-12-31T23:58:00.000Z",
      };
      gatekeeper = await fakes.http([{ path: `/v1/gates/${GATE}`, body: gate }]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens the run\'s page with "CONSOLE_GATEKEEPER_URL" set to gatekeeper', async () => {
    await serving(sut, [api.url], { CONSOLE_GATEKEEPER_URL: gatekeeper.url, CONSOLE_GATEKEEPER_TOKEN: "gate-token-1" });
    page = await open(sut, `/runs/${RUN}`);
  });

  await then(
    'the page shows the gate "g0123456789abcdef" of the stage "ship" as "pending", waiting for "leads"',
    async () => {
      expect(rows(page.html)[1]).toEqual([
        "ship",
        "shipper",
        "blocked",
        "",
        `${GATE} pending, waiting for leads`,
        "",
        "",
      ]);
      expect(gatekeeper.headers().map((request) => [request.path, request.headers.authorization])).toEqual([
        [`/v1/gates/${GATE}`, "Bearer gate-token-1"],
      ]);
    },
  );
});
