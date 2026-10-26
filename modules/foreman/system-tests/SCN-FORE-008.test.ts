import { scenario } from "@opensoftware/testkit";
import { committed, readmeWork, servingCommit } from "./foreman.ts";

scenario("SCN-FORE-008", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingCommit>>;
  let commit = "";
  await given('the README\'s "factory.yaml" is committed in the factory\'s repository', async () => {
    commit = await committed(sut, fakes);
  });
  await given('"foreman serve" runs it with a scripted harness that ends every turn', async () => {
    server = await servingCommit(sut, fakes, commit);
  });

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then('"/v1/runs/<id>" shows the factory "hello" and that commit as the factory version', async () => {
    const view = await server.until(runId, "complete");
    expect(commit).toMatch(/^[0-9a-f]{40}$/);
    expect(view).toMatchObject({ factory: "hello", factoryVersion: commit });
  });
});
