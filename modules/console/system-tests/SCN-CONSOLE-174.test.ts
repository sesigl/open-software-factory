import { type Page, scenario } from "@opensoftware/testkit";
import { links } from "./console.ts";
import { ADMIN, secretRow, servingSecrets, storeForm } from "./secrets.ts";

scenario("SCN-CONSOLE-174", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory whose agents "triage" and "review" declare "ref:openbao/linear-token" and may reach "api.linear.app", and a store without it',
    async () => {
      const agent = { secrets: ["ref:openbao/linear-token"], egress: ["api.linear.app"] };
      await servingSecrets(sut, fakes, { triage: agent, review: agent });
    },
  );

  let page: Page;
  await when('the admin opens "/secrets"', async () => {
    page = await sut.pages.open("/secrets", { headers: ADMIN });
  });

  await then('the list says "linear-token" is "Missing", "Needed by the agents review and triage"', async () => {
    expect(page.status).toBe(200);
    expect(secretRow(page, "linear-token")).toBe(
      "linear-token Needed by the agents review and triage Missing Store a value linear-token",
    );
  });

  await then('the navigation\'s link "Secrets" is the current page and says "1 missing"', async () => {
    const navigation = page.getByRole("navigation", { name: "Main" });
    const current = navigation.getByRole("link", { current: "page" });
    expect([current.attribute("href"), current.text]).toEqual(["/secrets", "Secrets 1 missing"]);
    expect(links(navigation).map((link) => link.href)).toEqual(["/", "/secrets", "/skills", "/factory", "/health"]);
  });

  await then(
    'the form "Store a value" is for "linear-token", with a password field "Value" that the browser does not fill, and says that the value is sent only to "api.linear.app"',
    async () => {
      const form = storeForm(page);
      const value = form.getByLabelText("Value");
      expect(form.getByLabelText("Name").attribute("value")).toBe("linear-token");
      expect([value.attribute("type"), value.attribute("autocomplete"), value.attribute("value")]).toEqual([
        "password",
        "off",
        undefined,
      ]);
      expect(form.getByText(/^Takes effect/).text).toBe(
        "Takes effect in the next sandbox that starts. Sent only to api.linear.app.",
      );
      expect(page.forms).toContainEqual({ name: "Store a value", method: "post", action: "/secrets" });
    },
  );
});
