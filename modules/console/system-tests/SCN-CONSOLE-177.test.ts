import { type Page, scenario } from "@opensoftware/testkit";
import { navLinks } from "./console.ts";
import { ADMIN, type Store, servingSecrets, VALUE } from "./secrets.ts";

const VARUN = { "x-forwarded-email": "varun@acme.dev" };

scenario("SCN-CONSOLE-177", async ({ sut, fakes, given, when, then }) => {
  let store: Store;
  await given(
    'a console behind a sign-in proxy with an access file with "ada@acme.dev" as "admin" and "varun@acme.dev" as "member", and a store',
    async () => {
      store = await servingSecrets(
        sut,
        fakes,
        { triage: { secrets: ["ref:openbao/linear-token"] } },
        { people: { "ada@acme.dev": "admin", "varun@acme.dev": "member" } },
      );
    },
  );

  let secrets: Page;
  let runs: Page;
  let form: Page;
  let admin: Page;
  await when(
    '"varun@acme.dev" opens "/secrets" and "/", and sends the form "Store value", and "ada@acme.dev" opens "/"',
    async () => {
      secrets = await sut.pages.open("/secrets", { headers: VARUN });
      runs = await sut.pages.open("/", { headers: VARUN });
      form = await sut.pages.send(
        "/secrets",
        { name: "linear-token", value: VALUE },
        { headers: VARUN, follow: false },
      );
      admin = await sut.pages.open("/", { headers: ADMIN });
    },
  );

  await then(
    'the page and the form answer 403 and say "varun@acme.dev has the role member: Secrets needs the role admin"',
    async () => {
      expect([secrets.status, form.status]).toEqual([403, 403]);
      expect(secrets.text).toContain("varun@acme.dev has the role member: Secrets needs the role admin");
      expect(form.text).toContain("varun@acme.dev has the role member: Secrets needs the role admin");
    },
  );

  await then(
    'the navigation of "varun@acme.dev" does not link "Secrets", and the navigation of "ada@acme.dev" links "/secrets"',
    async () => {
      expect(navLinks(runs).map((link) => link.href)).toEqual(["/", "/factory", "/health"]);
      expect(navLinks(admin).map((link) => link.href)).toEqual(["/", "/secrets", "/factory", "/health"]);
    },
  );

  await then('the store holds no value of "linear-token"', async () => {
    expect(await store.bao.read("linear-token")).toBeUndefined();
  });
});
