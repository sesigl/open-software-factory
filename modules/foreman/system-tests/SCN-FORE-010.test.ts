import { scenario } from "@opensoftware/testkit";
import { API_TOKEN } from "./foreman.ts";

scenario("SCN-FORE-010", async ({ sut, given, when, then }) => {
  await given(
    'a "factory.yaml" whose stage "review" names the agent "reviewer", which the factory does not declare',
    async () => {
      await sut.files.put(
        "$INPUT/factory.yaml",
        [
          "version: 1",
          "factory: hello",
          "agents:",
          "  review:",
          "    harness: acp",
          "    model: routes/default",
          "    prompt: ./review.md",
          "workflow:",
          "  - stage: review",
          "    agent: reviewer",
          "",
        ].join("\n"),
      );
      await sut.git.commit("a factory with an unknown agent");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the output contains "factory.yaml: /workflow/0/agent: no agent \\"reviewer\\""', async () => {
    expect(run.stderr).toContain('factory.yaml: /workflow/0/agent: no agent "reviewer"');
  });
});
