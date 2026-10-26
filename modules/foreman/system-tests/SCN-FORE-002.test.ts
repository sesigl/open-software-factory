import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeWork, serving, TITLE } from "./foreman.ts";

scenario("SCN-FORE-002", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes);
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const { data } = await server.start(readmeWork(fakes));
    await server.until(data?.runId as string, "complete");
  });

  await then('the harness received a prompt with "Write a plan" and "Export reports as CSV"', async () => {
    const [first] = server.harness.prompts();
    expect(first).toContain(PLAN);
    expect(first).toContain(TITLE);
    expect(first).toContain(readmeWork(fakes).id);
  });

  await then('then a prompt with "Implement plan.md" and "Export reports as CSV"', async () => {
    const prompts = server.harness.prompts();
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(IMPLEMENT);
    expect(prompts[1]).toContain(TITLE);
  });
});
