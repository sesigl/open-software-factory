import { type SentryAlert, scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

scenario("SCN-INTAKE-027", async ({ sut, fakes, given, when, then }) => {
  const sentry = await fakes.sentry();
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with "INTAKE_SENTRY_SECRET"', async () => {
    server = await serving(sut, { INTAKE_SENTRY_SECRET: sentry.clientSecret });
  });

  let alert: SentryAlert;
  await when('Sentry sends the signed alert "TypeError: total is undefined" of level "error"', async () => {
    alert = await sentry.alert(`${server.url}/sentry/events`, {
      title: "TypeError: total is undefined",
      level: "error",
    });
  });

  await then("the answer has the status 200", async () => {
    expect(alert.status).toBe(200);
  });

  await then('"/v1/work-items/<id of the Sentry issue>" answers the status 404', async () => {
    expect((await server.byKey(`sentry:${alert.issueId}`)).status).toBe(404);
  });
});
