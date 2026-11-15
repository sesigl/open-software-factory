import { type Page, scenario } from "@opensoftware/testkit";
import { foreman, navLinks, serving } from "./console.ts";
import { ADMIN, CLOSED, factoryOf, store } from "./secrets.ts";

scenario("SCN-CONSOLE-179", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email" and no access file, and a store',
    async () => {
      const { env } = await store(sut, fakes);
      const factory = await factoryOf(sut, { triage: { secrets: ["ref:openbao/linear-token"] } });
      await serving(sut, [(await foreman(fakes, [])).url], {
        ...factory,
        ...env,
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
      });
    },
  );

  let secrets: Page;
  let runs: Page;
  await when('the proxy sends "ada@acme.dev" to "/secrets" and to "/"', async () => {
    secrets = await sut.pages.open("/secrets", { headers: ADMIN });
    runs = await sut.pages.open("/", { headers: ADMIN });
  });

  await then(
    '"/secrets" answers 404 and says "no secrets: they need a person with the role admin, so set CONSOLE_SIGN_IN, or an access file with CONSOLE_USER_HEADER"',
    async () => {
      expect(secrets.status).toBe(404);
      expect(secrets.text).toContain(CLOSED);
    },
  );

  await then('the navigation of "/" does not link "Secrets"', async () => {
    expect(navLinks(runs).map((link) => link.text)).toEqual(["Runs", "Skills", "Factory", "Health"]);
  });
});
