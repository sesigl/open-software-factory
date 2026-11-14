import { scenario } from "@opensoftware/testkit";
import { committed, readmeWork, servingCommit } from "./foreman.ts";

scenario("SCN-FORE-156", async ({ sut, fakes, given, when, then }) => {
  let commit = "";
  await given(
    'the README\'s "factory.yaml" is committed in a Git repository that the server reaches at a "file://" URL',
    async () => {
      commit = await committed(sut, fakes);
    },
  );
  await given('the repository\'s "agents/plan.md" has a change that is not committed', async () => {
    await sut.files.put("$INPUT/agents/plan.md", "a change that is not committed\n");
  });

  let server: Awaited<ReturnType<typeof servingCommit>>;
  await given(
    '"foreman serve" runs with "FOREMAN_FACTORY" set to "git+<url>" without a ref and a scripted harness',
    async () => {
      const url = `file://${sut.files.path("$INPUT")}`;
      server = await servingCommit(sut, fakes, commit, {
        env: {
          FOREMAN_FACTORY: `git+${url}`,
          OSF_DATA: sut.files.path("$OUTPUT/data"),
        },
      });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the factory "hello" and the commit of the default branch as the factory version',
    async () => {
      const view = await server.until(runId, "complete");
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
      expect(view).toMatchObject({ factory: "hello", factoryVersion: commit });
    },
  );
});
