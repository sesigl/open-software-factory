import { scenario } from "@opensoftware/testkit";
import { deliveries, forgeEnv, githubTo, serving } from "./server.ts";

scenario("SCN-INTAKE-023", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    'the server runs with the GitHub forge adapter and "INTAKE_WEBHOOK_SECRET" set to "whsec-51c2"',
    async () => {
      server = await serving(sut, forgeEnv(sut));
    },
  );

  let status = 0;
  let issue: { url: string };
  await when('a delivery of the label "factory" on an issue arrives signed with "whsec-other"', async () => {
    const receiver = await deliveries(fakes);
    issue = await (await githubTo(fakes, receiver.url, "whsec-other")).labeled("factory");
    status = await receiver.forward(server.url);
  });

  await then("the answer has the status 401", async () => {
    expect(status).toBe(401);
  });

  await then('"/v1/work-items/<id of the issue\'s link>" answers the status 404', async () => {
    expect((await server.byKey(issue.url)).status).toBe(404);
  });
});
