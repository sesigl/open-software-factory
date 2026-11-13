import { scenario } from "@opensoftware/testkit";
import { readmeFiles, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-132", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes);
    },
  );

  await given('"factory.yaml" gets a change that is not committed', async () => {
    await sut.files.put("$INPUT/factory.yaml", `${readmeFiles(fakes)["factory.yaml"]}# a change\n`);
  });

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    answer = await server.start(readmeWork(fakes));
  });

  await then(
    'the answer has the status 400 and a problem that says "commit the changed files factory.yaml"',
    async () => {
      expect(answer.response.status).toBe(400);
      expect(answer.error).toEqual({
        title: "Bad request",
        status: 400,
        detail: "factory.yaml: commit the changed files factory.yaml; a run's factory version is its commit",
      });
    },
  );

  await then("the scripted harness got no session", async () => {
    expect(server.harness.sessions()).toEqual([]);
  });
});
