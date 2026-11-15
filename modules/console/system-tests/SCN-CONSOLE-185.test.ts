import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN, secretRows, servingSecrets } from "./secrets.ts";

scenario("SCN-CONSOLE-185", async ({ sut, fakes, given, when, then }) => {
  const address = "http://127.0.0.1:1";
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", and "OSF_OPENBAO_ADDR" names a port where nothing listens',
    async () => {
      await servingSecrets(
        sut,
        fakes,
        { triage: { secrets: ["ref:openbao/linear-token"] } },
        { env: { OSF_OPENBAO_ADDR: address } },
      );
    },
  );

  let page: Page;
  await when('the admin opens "/secrets"', async () => {
    page = await sut.pages.open("/secrets", { headers: ADMIN });
  });

  await then('the page says "The secrets could not be listed: the store at <address> does not answer"', async () => {
    expect(page.status).toBe(200);
    expect(page.getByRole("alert").text).toBe(
      `The secrets could not be listed: the store at ${address} does not answer`,
    );
  });

  await then('the list says "linear-token" is "Unknown", "Needed by the agent triage"', async () => {
    expect(secretRows(page)).toEqual(["linear-token Needed by the agent triage Unknown"]);
  });
});
