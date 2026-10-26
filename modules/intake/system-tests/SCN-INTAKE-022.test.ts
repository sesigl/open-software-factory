import { scenario } from "@opensoftware/testkit";
import { deliveries, forgeEnv, githubTo, serving } from "./server.ts";

scenario("SCN-INTAKE-022", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let receiver: Awaited<ReturnType<typeof deliveries>>;
  let github: Awaited<ReturnType<typeof githubTo>>;
  await given(
    'the server runs with the GitHub forge adapter and a webhook of "tester/web" for labels on issues',
    async () => {
      server = await serving(sut, forgeEnv(sut));
      receiver = await deliveries(fakes);
      github = await githubTo(fakes, receiver.url);
    },
  );

  let issue: { url: string };
  await when('"tester" adds the label "question" to the issue "Export reports as CSV"', async () => {
    issue = await github.labeled("question");
    expect(await receiver.forward(server.url)).toBe(200);
  });

  await then('"/v1/work-items/<id of the issue\'s link>" answers the status 404', async () => {
    expect((await server.byKey(issue.url)).status).toBe(404);
  });
});
