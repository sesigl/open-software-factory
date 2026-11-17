import { type FakeHttp, type FakeSentry, scenario } from "@opensoftware/testkit";
import { hmacHex } from "./hmac.ts";

scenario("SCN-TK-104", async ({ fakes, given, when, then }) => {
  let sentry: FakeSentry;
  let webhook: FakeHttp;
  await given("fakes.sentry and a webhook of fakes.http", async () => {
    sentry = await fakes.sentry();
    webhook = await fakes.http([{ method: "POST", path: "/alerts", body: {} }]);
  });

  await when('fakes.sentry sends the webhook the alert "TypeError: total is undefined" of level "fatal"', async () => {
    const alert = await sentry.alert(`${webhook.url}/alerts`, {
      title: "TypeError: total is undefined",
      level: "fatal",
    });
    expect(alert.status).toBe(200);
  });

  await then(
    'the webhook got one alert "TypeError: total is undefined fatal" whose Sentry-Hook-Signature matches the client secret',
    async () => {
      const texts = webhook.texts().map(({ text }) => text);
      const signatures = webhook.headers().map(({ headers }) => headers["sentry-hook-signature"]);
      expect(signatures).toEqual(await Promise.all(texts.map((text) => hmacHex(sentry.clientSecret, text))));
      const alerts = texts.map((text) => JSON.parse(text).data.event);
      expect(alerts.map((event) => `${event.title} ${event.level}`)).toEqual(["TypeError: total is undefined fatal"]);
    },
  );
});
