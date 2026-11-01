import { scenario } from "@opensoftware/testkit";
import { readmeFiles, readmeWork, type Sessions, serving } from "./foreman.ts";

scenario("SCN-FORE-069", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with the effort "high" for the agent "implement" and a scripted harness that ends every turn',
    async () => {
      const factory = (readmeFiles(fakes)["factory.yaml"] as string).replace(
        "    effort: medium\n    prompt: ./agents/implement.md",
        "    effort: high\n    prompt: ./agents/implement.md",
      );
      server = await serving(sut, fakes, { factory });
    },
  );

  let sessions: Sessions = [];
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
    sessions = server.harness.sessions();
  });

  await then('the "plan" session\'s agent got "medium" as "OSF_EFFORT"', async () => {
    expect(sessions[0]?.env).toMatchObject({ OSF_EFFORT: "medium" });
  });

  await then('the "implement" session\'s agent got "high" as "OSF_EFFORT"', async () => {
    expect(sessions[1]?.env).toMatchObject({ OSF_EFFORT: "high" });
  });
});
