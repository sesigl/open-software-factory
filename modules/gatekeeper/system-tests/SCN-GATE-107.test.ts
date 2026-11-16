import { scenario } from "@opensoftware/testkit";
import { statuses } from "./gate.ts";
import { type GateAnswer, linking, prServing } from "./server.ts";

scenario("SCN-GATE-107", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof prServing>>;
  await given(
    'the server runs with "GATEKEEPER_FORGE_TOKEN" and "GATEKEEPER_FORGE_URL", and without a Slack channel',
    async () => {
      server = await prServing(sut, fakes);
    },
  );

  let answer: GateAnswer;
  await when(
    'a program posts a request that links the pull request "acme/web#12" of that forge to "/v1/gates"',
    async () => {
      answer = await server.post(linking(server.pr));
    },
  );

  await then(
    'the answer has the status 201 and a gate in the state "pending" for the channel of the pull request\'s link',
    async () => {
      expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
      expect(answer.data).toMatchObject({ channel: server.pr, state: "pending", waitingFor: ["maintainers"] });
    },
  );

  await then('the pull request has a comment that asks "maintainers" to approve with "/approve"', async () => {
    const posted = server.http.received().filter((call) => call.method === "POST" && call.path.endsWith("/comments"));
    expect(posted.map((call) => (call.body as { body: string }).body)).toEqual([
      `Approval needed from maintainers: Implement the research skill\n- Pull request: ${server.pr}\nComment "/approve" or "/reject <reason>".\n\n<!-- gatekeeper ${answer.data?.id} requested -->`,
    ]);
  });

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "pending"',
    async () => {
      expect(statuses(server.http)).toEqual([
        { state: "pending", context: "gatekeeper", description: "waiting for maintainers", target_url: server.pr },
      ]);
    },
  );
});
