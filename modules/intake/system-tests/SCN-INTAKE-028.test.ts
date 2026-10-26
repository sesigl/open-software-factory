import { type SentryAlert, scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

scenario("SCN-INTAKE-028", async ({ sut, fakes, given, when, then }) => {
  const sentry = await fakes.sentry();
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with "INTAKE_SENTRY_SECRET"', async () => {
    server = await serving(sut, { INTAKE_SENTRY_SECRET: sentry.clientSecret });
  });

  let alert: SentryAlert;
  await when(
    'the alert "TypeError: total is undefined" of level "fatal" arrives signed with another secret',
    async () => {
      const event = { title: "TypeError: total is undefined", level: "fatal" };
      alert = await sentry.alert(`${server.url}/sentry/events`, event, "another-secret");
    },
  );

  await then("the answer has the status 401", async () => {
    expect(alert.status).toBe(401);
    expect((await server.byKey(`sentry:${alert.issueId}`)).status).toBe(404);
  });
});
