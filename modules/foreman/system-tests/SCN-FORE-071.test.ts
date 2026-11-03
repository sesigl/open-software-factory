import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

const ISSUE = "https://github.com/tester/web/issues/3";

scenario("SCN-FORE-071", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes);
    },
  );

  await when(
    'a program posts the README\'s "work.json" with the origin "https://github.com/tester/web/issues/3" to "/v1/runs"',
    async () => {
      const work = { ...readmeWork(fakes), origin: { source: "github", url: ISSUE } };
      const { data } = await server.start(work);
      await server.until(data?.runId as string, "complete");
    },
  );

  await then(
    'every prompt the harness received has the line "Origin: https://github.com/tester/web/issues/3"',
    async () => {
      const prompts = server.harness.prompts();
      expect(prompts).toHaveLength(2);
      for (const prompt of prompts) expect(prompt.split("\n")).toContain(`Origin: ${ISSUE}`);
    },
  );

  await then("no prompt has two empty lines in a row", async () => {
    const prompts = server.harness.prompts();
    expect(prompts.filter((prompt) => prompt.includes("\n\n\n"))).toEqual([]);
  });
});
