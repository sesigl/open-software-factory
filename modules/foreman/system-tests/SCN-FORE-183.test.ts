import { scenario } from "@opensoftware/testkit";
import { committed, readmeWork, servingCommit } from "./foreman.ts";

scenario("SCN-FORE-183", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingCommit>>;
  await given(
    '"foreman serve" runs with "FOREMAN_FACTORY" set to "git+<url>" of the README\'s "factory.yaml"',
    async () => {
      const commit = await committed(sut, fakes);
      // The remote is a link to the factory's repository, so the test can take it away.
      await sut.files.link("$OUTPUT/remote", sut.files.path("$INPUT"));
      server = await servingCommit(sut, fakes, commit, {
        env: {
          FOREMAN_FACTORY: `git+file://${sut.files.path("$OUTPUT/remote")}`,
          OSF_DATA: sut.files.path("$OUTPUT/data"),
        },
      });
    },
  );

  await given("the Git remote is gone", async () => {
    await sut.files.remove("$OUTPUT/remote");
  });

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    answer = await server.start(readmeWork(fakes));
  });

  await then(
    'the answer has the status 503 and a problem that says "FOREMAN_FACTORY: cannot fetch HEAD of file://"',
    async () => {
      expect(answer.response.status).toBe(503);
      expect(answer.error).toMatchObject({ title: "The factory cannot be read now", status: 503 });
      expect((answer.error as { detail: string }).detail).toContain("FOREMAN_FACTORY: cannot fetch HEAD of file://");
    },
  );

  await then("the scripted harness got no session", async () => {
    expect(server.harness.sessions()).toEqual([]);
  });
});
