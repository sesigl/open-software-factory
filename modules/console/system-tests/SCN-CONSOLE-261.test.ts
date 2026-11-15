import { type Page, scenario } from "@opensoftware/testkit";
import { propose, servingChanges, unreachableEnv } from "./changes.ts";
import { links, open } from "./console.ts";

const GRACE = { "x-forwarded-email": "grace@acme.dev" };
const VARUN = { "x-forwarded-email": "varun@acme.dev" };

scenario("SCN-CONSOLE-261", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with a secret store, a factory repository that does not answer, "grace@acme.dev" as "factory-engineer" and "varun@acme.dev" as "member"',
    async () => {
      // The console refuses both before it asks the store or the forge, so neither has to answer.
      await servingChanges(sut, fakes, { ...unreachableEnv(sut), OSF_OPENBAO_ADDR: "http://127.0.0.1:9" });
    },
  );

  let pages: Page[] = [];
  await when(
    '"grace@acme.dev" opens "/secrets/delete?name=linear-token" and "varun@acme.dev" sends the form "Propose change"',
    async () => {
      pages = [await open(sut, "/secrets/delete?name=linear-token", GRACE), await propose(sut, undefined, VARUN)];
    },
  );

  await then('both answer 403 with the title "Forbidden"', async () => {
    expect(pages.map((page) => [page.status, page.getByRole("heading", { level: 1 }).text])).toEqual([
      [403, "Forbidden"],
      [403, "Forbidden"],
    ]);
  });

  await then(
    'the page of "grace@acme.dev" leads back to "Secrets" at "/secrets", and the page of "varun@acme.dev" to "Changes" at "/changes"',
    async () => {
      expect(pages.map((page) => links(page.getByRole("main"))[0])).toEqual([
        { href: "/secrets", text: "Secrets" },
        { href: "/changes", text: "Changes" },
      ]);
    },
  );
});
