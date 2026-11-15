import { type Page, scenario } from "@opensoftware/testkit";
import { foreman, serving } from "./console.ts";
import { CLOSED, factoryOf, store, VALUE } from "./secrets.ts";

scenario("SCN-CONSOLE-232", async ({ sut, fakes, given, when, then }) => {
  await given('a console without "CONSOLE_SIGN_IN" and "CONSOLE_USER_HEADER", and a store', async () => {
    const { env } = await store(sut, fakes);
    const factory = await factoryOf(sut, { triage: { secrets: ["ref:openbao/linear-token"] } });
    await serving(sut, [(await foreman(fakes, [])).url], { ...factory, ...env });
  });

  let page: Page;
  let form: Page;
  await when('a person opens "/secrets" and a program sends the form "Store value"', async () => {
    page = await sut.pages.open("/secrets");
    form = await sut.pages.send("/secrets", { name: "linear-token", value: VALUE }, { follow: false });
  });

  await then(
    'both answer 404 and say "no secrets: they need a person with the role admin or factory-engineer, so set CONSOLE_SIGN_IN, or an access file with CONSOLE_USER_HEADER"',
    async () => {
      expect([page.status, form.status]).toEqual([404, 404]);
      expect(page.text).toContain(CLOSED);
      expect(form.text).toContain(CLOSED);
    },
  );
});
