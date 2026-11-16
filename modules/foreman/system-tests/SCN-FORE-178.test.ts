import { scenario } from "@opensoftware/testkit";
import { gatedFactory, IMPLEMENT, PLAN, readmeWork, serving } from "./foreman.ts";

const ELSEWHERE = "https://forge.example/tester/web/pull/7";
const ISSUE = "https://github.com/tester/web/issues/3";

scenario("SCN-FORE-178", async ({ sut, fakes, given, when, then }) => {
  let factory = "";
  await given(
    'the README\'s factory with a gate before the stage "implement", whose "plan" turn replies with the link "https://forge.example/tester/web/pull/7"',
    async () => {
      factory = gatedFactory(fakes);
    },
  );

  let server: Awaited<ReturnType<typeof serving>>;
  await given('gatekeeper answers a request with the gate "g0a1b2c3d4e5f6a7b"', async () => {
    server = await serving(sut, fakes, {
      factory,
      gatekeeper: true,
      turns: [
        { when: PLAN, reply: `Opened ${ELSEWHERE} with the plan.` },
        { when: IMPLEMENT, reply: "done" },
      ],
    });
  });

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" with the origin "https://github.com/tester/web/issues/3" to "/v1/runs"',
    async () => {
      const work = { ...readmeWork(fakes), origin: { source: "github", url: ISSUE } };
      runId = (await server.start(work)).data?.runId as string;
    },
  );

  await then('gatekeeper received a request for the stage "implement" with only the link "Origin"', async () => {
    await server.until(runId, "blocked");
    const [request] = server.gatekeeper?.received() ?? [];
    expect(request).toMatchObject({ body: { stage: "implement" } });
    expect((request?.body as { links?: unknown } | undefined)?.links).toEqual([{ url: ISSUE, title: "Origin" }]);
  });
});
