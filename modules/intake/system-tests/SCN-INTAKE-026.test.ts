import { type SentryAlert, scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

scenario("SCN-INTAKE-026", async ({ sut, fakes, given, when, then }) => {
  const sentry = await fakes.sentry();
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    'the server runs with "INTAKE_SENTRY_SECRET" and "INTAKE_SENTRY_CHANGE_URL" set to "https://github.com/acme/web/commit/{release}"',
    async () => {
      server = await serving(sut, {
        INTAKE_SENTRY_SECRET: sentry.clientSecret,
        INTAKE_SENTRY_CHANGE_URL: "https://github.com/acme/web/commit/{release}",
      });
    },
  );

  let alert: SentryAlert;
  await when(
    'Sentry sends the signed alert "TypeError: total is undefined" of level "fatal" in the release "4c5d6e7"',
    async () => {
      const event = { title: "TypeError: total is undefined", level: "fatal", release: "4c5d6e7" };
      alert = await sentry.alert(`${server.url}/sentry/events`, event);
      expect(alert.status).toBe(200);
    },
  );

  let view: Awaited<ReturnType<typeof server.byKey>>["view"];
  await then(
    '"/v1/work-items/<id>" shows a work item of type "bug" with the title "TypeError: total is undefined"',
    async () => {
      view = (await server.byKey(`sentry:${alert.issueId}`)).view;
      expect(view?.workItem).toMatchObject({ type: "bug", title: "TypeError: total is undefined" });
      expect(await server.workItem(view?.workItem.id as string)).toEqual(view);
    },
  );

  await then('it links the error in Sentry and "https://github.com/acme/web/commit/4c5d6e7"', async () => {
    expect(view?.workItem.links?.map((link) => link.url)).toEqual([
      alert.webUrl,
      "https://github.com/acme/web/commit/4c5d6e7",
    ]);
  });

  await then(
    'it shows the requester "sentry:fatal-errors" and the origin "sentry" with the link to the error',
    async () => {
      expect(view?.workItem.requester).toEqual({ kind: "trigger", id: "sentry:fatal-errors" });
      expect(view?.workItem.origin).toEqual({ source: "sentry", url: alert.webUrl, externalId: alert.issueId });
    },
  );
});
