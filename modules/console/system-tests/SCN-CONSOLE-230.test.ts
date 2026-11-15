import { type Page, scenario } from "@opensoftware/testkit";
import { navLinks } from "./console.ts";
import { ADMIN, ENGINEER, type Store, servingSecrets, VALUE } from "./secrets.ts";

const VARUN = { "x-forwarded-email": "varun@acme.dev" };
const REFUSED = "varun@acme.dev has the role member: Secrets needs the role admin or factory-engineer";

scenario("SCN-CONSOLE-230", async ({ sut, fakes, given, when, then }) => {
  let store: Store;
  await given(
    'a console behind a sign-in proxy with an access file with "ada@acme.dev" as "admin", "grace@acme.dev" as "factory-engineer" and "varun@acme.dev" as "member", and a store',
    async () => {
      store = await servingSecrets(
        sut,
        fakes,
        { triage: { secrets: ["ref:openbao/linear-token"] } },
        { people: { "ada@acme.dev": "admin", "grace@acme.dev": "factory-engineer", "varun@acme.dev": "member" } },
      );
    },
  );

  let secrets: Page;
  let runs: Page;
  let form: Page;
  let admin: Page;
  let engineer: Page;
  await when(
    '"varun@acme.dev" opens "/secrets" and "/", and sends the form "Store value", and "ada@acme.dev" and "grace@acme.dev" open "/"',
    async () => {
      secrets = await sut.pages.open("/secrets", { headers: VARUN });
      runs = await sut.pages.open("/", { headers: VARUN });
      form = await sut.pages.send(
        "/secrets",
        { name: "linear-token", value: VALUE },
        { headers: VARUN, follow: false },
      );
      admin = await sut.pages.open("/", { headers: ADMIN });
      engineer = await sut.pages.open("/", { headers: ENGINEER });
    },
  );

  await then(
    'the page and the form answer 403 and say "varun@acme.dev has the role member: Secrets needs the role admin or factory-engineer"',
    async () => {
      expect([secrets.status, form.status]).toEqual([403, 403]);
      expect(secrets.text).toContain(REFUSED);
      expect(form.text).toContain(REFUSED);
    },
  );

  await then(
    'the navigation of "varun@acme.dev" does not link "Secrets", and the navigations of "ada@acme.dev" and "grace@acme.dev" link "/secrets"',
    async () => {
      const all = ["/", "/secrets", "/skills", "/factory", "/health"];
      expect(navLinks(runs).map((link) => link.href)).toEqual(["/", "/skills", "/factory", "/health"]);
      expect(navLinks(admin).map((link) => link.href)).toEqual(all);
      expect(navLinks(engineer).map((link) => link.href)).toEqual(all);
    },
  );

  await then('the store holds no value of "linear-token"', async () => {
    expect(await store.bao.read("linear-token")).toBeUndefined();
  });
});
