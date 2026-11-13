import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-141", async ({ sut, fakes, given, when, then }) => {
  // 100 characters that are cut, then the last 4000 that the next stage gets.
  const kept = `Kept: ${"y".repeat(4000 - 16)} last line`;
  const message = `${"c".repeat(100)}${kept}`;
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness whose stage "plan" ends with a message of 4100 characters',
    async () => {
      expect(message).toHaveLength(4100);
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

  let section = "";
  await then(
    'the section "# Result of the stage plan" of the prompt of the stage "implement" starts with the line "[… the first 100 characters are cut]"',
    async () => {
      const [prompt] = server.harness.prompts().filter((text) => text.includes(IMPLEMENT));
      section = prompt?.split("\n\n# Result of the stage plan\n\n")[1] ?? "";
      expect(section.startsWith("[… the first 100 characters are cut]\n")).toBe(true);
    },
  );

  await then("then holds the last 4000 characters of the message", async () => {
    expect(section).toBe(`[… the first 100 characters are cut]\n${kept}\n`);
  });
});
