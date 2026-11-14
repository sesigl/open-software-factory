import { type Page, scenario } from "@opensoftware/testkit";
import { links } from "./console.ts";
import { ADMIN, secretRow, servingSecrets, storeForm, TIME, VALUE } from "./secrets.ts";

scenario("SCN-CONSOLE-175", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory whose agents declare no secret, and a store in which another program stored "sentry-token"',
    async () => {
      const store = await servingSecrets(sut, fakes, { triage: {} });
      await store.bao.write("sentry-token", { value: VALUE });
    },
  );

  let page: Page;
  await when('the admin opens "/secrets"', async () => {
    page = await sut.pages.open("/secrets", { headers: ADMIN });
  });

  await then(
    'the list says "sentry-token" is "Not used", "No agent declares it · version 1, set on <time>"',
    async () => {
      expect(secretRow(page, "sentry-token")).toMatch(
        new RegExp(`^sentry-token No agent declares it · version 1, set on ${TIME} Not used Delete sentry-token$`),
      );
    },
  );

  await then('its link "Delete sentry-token" leads to "/secrets/delete?name=sentry-token"', async () => {
    const list = page.getByRole("list", { name: "Secrets" });
    expect(links(list)).toEqual([{ href: "/secrets/delete?name=sentry-token", text: "Delete sentry-token" }]);
  });

  await then(
    'the form "Store a value" names no secret and says "Sent only to the hosts of the agents that declare it."',
    async () => {
      const form = storeForm(page);
      expect(form.getByLabelText("Name").attribute("value")).toBe("");
      expect(form.getByText(/^Takes effect/).text).toBe(
        "Takes effect in the next sandbox that starts. Sent only to the hosts of the agents that declare it.",
      );
    },
  );
});
