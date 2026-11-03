import { scenario } from "@opensoftware/testkit";
import { gatedFactory, IMPLEMENT, PLAN, readmeWork, serving } from "./foreman.ts";

const PULL_REQUEST = "https://github.com/tester/web/pull/7";

scenario("SCN-FORE-072", async ({ sut, fakes, given, when, then }) => {
  let factory = "";
  await given(
    'the README\'s factory with a gate before the stage "implement", whose "plan" turn replies with the link "https://github.com/tester/web/pull/7"',
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
        { when: PLAN, reply: `Opened ${PULL_REQUEST} with the plan.` },
        { when: IMPLEMENT, reply: "done" },
      ],
    });
  });

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    'gatekeeper received a request for the stage "implement" with the link "https://github.com/tester/web/pull/7" titled "Pull request"',
    async () => {
      await server.until(runId, "blocked");
      const [request] = server.gatekeeper?.received() ?? [];
      expect(request).toMatchObject({ body: { stage: "implement" } });
      expect((request?.body as { links?: unknown[] }).links).toEqual([{ url: PULL_REQUEST, title: "Pull request" }]);
    },
  );
});
