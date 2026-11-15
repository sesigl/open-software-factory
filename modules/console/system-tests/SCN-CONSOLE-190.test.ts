import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN, secretRows, servingSecrets } from "./secrets.ts";

scenario("SCN-CONSOLE-190", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", and "CONSOLE_SECRETS_ADAPTER" is "echo", which prints its arguments',
    async () => {
      await servingSecrets(
        sut,
        fakes,
        { triage: { secrets: ["ref:openbao/linear-token"] } },
        { env: { CONSOLE_SECRETS_ADAPTER: "echo" } },
      );
    },
  );

  let page: Page;
  await when('the admin opens "/secrets"', async () => {
    page = await sut.pages.open("/secrets", { headers: ADMIN });
  });

  await then(
    'the page says "The secrets could not be listed: the secrets adapter printed a line that is no JSON"',
    async () => {
      expect(page.status).toBe(200);
      expect(page.getByRole("alert").text).toBe(
        "The secrets could not be listed: the secrets adapter printed a line that is no JSON",
      );
    },
  );

  await then('the list says "linear-token" is "Unknown", "Needed by the agent triage"', async () => {
    expect(secretRows(page)).toEqual(["linear-token Needed by the agent triage Unknown"]);
  });
});
