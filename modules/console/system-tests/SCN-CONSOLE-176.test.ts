import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN, secretRows, servingSecrets } from "./secrets.ts";

scenario("SCN-CONSOLE-176", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory whose agent "ship" declares "ref:env/GH_TOKEN" and "ref:file/linear-token", and an empty store',
    async () => {
      await servingSecrets(sut, fakes, { ship: { secrets: ["ref:env/GH_TOKEN", "ref:file/linear-token"] } });
    },
  );

  let page: Page;
  await when('the admin opens "/secrets"', async () => {
    page = await sut.pages.open("/secrets", { headers: ADMIN });
  });

  await then(
    'the list says "GH_TOKEN" is "Set outside the UI", "Used by the agent ship · from the variable OSF_SECRET_GH_TOKEN of the sandbox adapter"',
    async () => {
      expect(secretRows(page)[0]).toBe(
        "GH_TOKEN Used by the agent ship · from the variable OSF_SECRET_GH_TOKEN of the sandbox adapter Set outside the UI",
      );
    },
  );

  await then(
    'it says "linear-token" is "Set outside the UI", "Used by the agent ship · from the file linear-token in OSF_SECRETS_DIR of the sandbox adapter"',
    async () => {
      expect(secretRows(page).slice(1)).toEqual([
        "linear-token Used by the agent ship · from the file linear-token in OSF_SECRETS_DIR of the sandbox adapter Set outside the UI",
      ]);
    },
  );

  await then(
    "the page says when a new value takes effect, that it goes only to the hosts the agent may reach, and that a secret outside an HTTP request does not work this way",
    async () => {
      expect(page.getByText(/^You store values here/).text).toBe(
        "You store values here. Which agent may use a secret is decided in the factory definition. An agent never holds a value: its sandbox's egress proxy adds it on the way out, only to the hosts the agent may reach.",
      );
      expect(page.getByText(/^The egress proxy reads/).text).toBe(
        "The egress proxy reads a value at the first request that needs it and keeps it while its sandbox runs, so a new value counts from the next sandbox that starts, like the next run's. A secret that is not sent in an HTTP request, like an SSH key or a database password, does not work this way.",
      );
    },
  );
});
