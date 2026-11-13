import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-140", async ({ sut, fakes, given, when, then }) => {
  // 4000 characters, the bound, with a start and an end the test can find.
  const message = `Triage found: ${"x".repeat(4000 - 29)} end of triage.`;
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness whose stage "plan" ends with a message of 4000 characters',
    async () => {
      expect(message).toHaveLength(4000);
      server = await serving(sut, fakes, {
        turns: [
          { when: PLAN, reply: message },
          { when: IMPLEMENT, reply: "done" },
        ],
      });
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const { data } = await server.start(readmeWork(fakes));
    await server.until(data?.runId as string, "complete");
  });

  await then(
    'the prompt of the stage "implement" ends with the section "# Result of the stage plan" that holds the whole message',
    async () => {
      const [prompt] = server.harness.prompts().filter((text) => text.includes(IMPLEMENT));
      expect(prompt?.endsWith(`\n\n# Result of the stage plan\n\n${message}\n`)).toBe(true);
    },
  );

  await then('the prompt of the stage "plan" has no section "# Result of the stage"', async () => {
    const [prompt] = server.harness.prompts().filter((text) => text.includes(PLAN));
    expect(prompt).toContain(readmeWork(fakes).title);
    expect(prompt).not.toContain("# Result of the stage");
  });
});
