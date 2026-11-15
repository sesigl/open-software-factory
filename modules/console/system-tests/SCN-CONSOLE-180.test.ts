import { type Page, scenario } from "@opensoftware/testkit";
import { foreman, serving } from "./console.ts";
import { ADMIN, factoryOf } from "./secrets.ts";
import { accessYaml } from "./signin.ts";

scenario("SCN-CONSOLE-180", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with "ada@acme.dev" as "admin" and without "OSF_OPENBAO_ADDR"',
    async () => {
      await sut.files.put("$INPUT/access.yaml", accessYaml());
      const factory = await factoryOf(sut, { triage: { secrets: ["ref:openbao/linear-token"] } });
      await serving(sut, [(await foreman(fakes, [])).url], { ...factory, CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let page: Page;
  await when('"ada@acme.dev" opens "/secrets"', async () => {
    page = await sut.pages.open("/secrets", { headers: ADMIN });
  });

  await then(
    'the page answers 404 and says "no secret store: set OSF_OPENBAO_ADDR and OSF_OPENBAO_TOKEN to the factory\'s OpenBao"',
    async () => {
      expect(page.status).toBe(404);
      expect(page.text).toContain(
        "no secret store: set OSF_OPENBAO_ADDR and OSF_OPENBAO_TOKEN to the factory's OpenBao",
      );
    },
  );
});
