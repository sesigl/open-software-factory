import { type Page, scenario } from "@opensoftware/testkit";
import { navLinks, serving } from "./console.ts";
import { factoryOf, store } from "./secrets.ts";
import { signedIn, signInEnv } from "./signin.ts";
import { factoryProgram, skillOf } from "./skills.ts";

scenario("SCN-CONSOLE-202", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect, an access file with "varun@acme.dev" as "member", a store, and the skill "release-notes" whose agent gives "LINEAR_TOKEN" with "ref:openbao/linear-token" without a value',
    async () => {
      setup = await signInEnv(sut, fakes, { "ada@acme.dev": "admin", "varun@acme.dev": "member" });
      const { env } = await store(sut, fakes);
      const skill = skillOf(
        "release-notes",
        { triage: { secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } } },
        { needs: { secrets: ["LINEAR_TOKEN"], hosts: [] } },
      );
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], {
        ...setup.env,
        ...env,
        ...(await factoryOf(sut, { triage: { secrets: ["ref:openbao/linear-token"] } })),
        CONSOLE_FACTORY_COMMAND: await factoryProgram(sut, [skill]),
      });
    },
  );

  await given('the provider signs in "varun@acme.dev"', async () => {
    setup.oidc.signIn({ email: "varun@acme.dev" });
  });

  let list: Page;
  let skill: Page;
  await when('the person signs in and opens "/skills" and "/skills/release-notes"', async () => {
    await signedIn(sut);
    list = await sut.pages.open("/skills");
    skill = await sut.pages.open("/skills/release-notes");
  });

  await then('both answer 200, and the navigation links "/skills" and not "/secrets"', async () => {
    expect([list.status, list.path, skill.status, skill.path]).toEqual([200, "/skills", 200, "/skills/release-notes"]);
    expect(navLinks(list).map((link) => link.href)).toEqual(["/", "/skills", "/factory", "/health"]);
  });

  await then(
    'the page of "release-notes" says "LINEAR_TOKEN" is "Missing" without the link "Store a value"',
    async () => {
      const needs = skill.getByRole("list", { name: "This skill needs" });
      expect(needs.queryAllByRole("listitem").map((item) => item.text)).toEqual([
        "Secret LINEAR_TOKEN From ref:openbao/linear-token Missing",
      ]);
      expect(needs.queryAllByRole("link")).toEqual([]);
    },
  );
});
