import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN, secretRow, servingSecrets, storeForm, VALUE } from "./secrets.ts";

scenario("SCN-CONSOLE-182", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"',
    async () => {
      await servingSecrets(sut, fakes, { triage: { secrets: ["ref:openbao/linear-token"] } });
    },
  );

  let page: Page;
  await when('"ada@acme.dev" sends a value for the name "team/../linear-token"', async () => {
    page = await sut.pages.send("/secrets", { name: "team/../linear-token", value: VALUE }, { headers: ADMIN });
  });

  await then(
    'the page answers 400 and says "Not stored: name the secret with A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token"',
    async () => {
      expect(page.status).toBe(400);
      expect(page.getByRole("alert").text).toBe(
        "Not stored: name the secret with A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token",
      );
    },
  );

  await then(
    'the form "Store a value" is for "team/../linear-token" again, its field "Value" is empty, and it says "Sent to no host: no agent that declares it may reach one."',
    async () => {
      const form = storeForm(page);
      expect(form.getByLabelText("Name").attribute("value")).toBe("team/../linear-token");
      expect(form.getByLabelText("Value").attribute("value")).toBeUndefined();
      expect(form.getByText(/^Takes effect/).text).toBe(
        "Takes effect in the next sandbox that starts. Sent to no host: no agent that declares it may reach one.",
      );
    },
  );

  await then('the list still says "linear-token" is "Missing"', async () => {
    expect(secretRow(page, "linear-token")).toBe(
      "linear-token Needed by the agent triage Missing Store a value linear-token",
    );
  });
});
