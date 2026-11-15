import { type Page, scenario } from "@opensoftware/testkit";
import { links } from "./console.ts";
import { ADMIN, ENGINEER, type Store, secretRow, servingSecrets, TIME, VALUE } from "./secrets.ts";

const SECOND = "lin_fake_value_second_9e4a_not_a_token";
const REFUSED = "grace@acme.dev has the role factory-engineer: deleting a secret needs the role admin";

scenario("SCN-CONSOLE-231", async ({ sut, fakes, given, when, then }) => {
  let store: Store;
  await given(
    'a console behind a sign-in proxy with an access file with "ada@acme.dev" as "admin" and "grace@acme.dev" as "factory-engineer", a store, and the stored secret "old-token" that no agent declares',
    async () => {
      store = await servingSecrets(
        sut,
        fakes,
        { triage: { secrets: ["ref:openbao/linear-token"] } },
        { people: { "ada@acme.dev": "admin", "grace@acme.dev": "factory-engineer" } },
      );
      await store.bao.write("old-token", { value: VALUE });
    },
  );

  let stored: Page[] = [];
  await when('"grace@acme.dev" stores a value for "linear-token" and then a second value', async () => {
    stored = [];
    for (const value of [VALUE, SECOND])
      stored.push(
        await sut.pages.send("/secrets", { name: "linear-token", value }, { headers: ENGINEER, follow: false }),
      );
  });

  let page: Page;
  let ask: Page;
  let removed: Page;
  await when(
    '"grace@acme.dev" opens "/secrets", opens "/secrets/delete?name=old-token" and sends its form',
    async () => {
      page = await sut.pages.open("/secrets", { headers: ENGINEER });
      ask = await sut.pages.open("/secrets/delete?name=old-token", { headers: ENGINEER });
      removed = await sut.pages.send("/secrets/delete", { name: "old-token" }, { headers: ENGINEER, follow: false });
    },
  );

  await then(
    '"linear-token" is "Set" in version 2 by "grace@acme.dev", and the store holds the second value',
    async () => {
      expect(stored.map((sent) => [sent.status, sent.location])).toEqual([
        [303, "/secrets"],
        [303, "/secrets"],
      ]);
      expect(secretRow(page, "linear-token")).toMatch(
        new RegExp(
          `^linear-token Used by the agent triage · version 2, set by grace@acme\\.dev on ${TIME} Set Replace linear-token$`,
        ),
      );
      expect(await store.bao.read("linear-token")).toMatchObject({ version: 2, data: { value: SECOND } });
    },
  );

  await then(
    'her page offers no "Delete" for "old-token", and the page and the form of the delete answer 403 and say "grace@acme.dev has the role factory-engineer: deleting a secret needs the role admin"',
    async () => {
      expect(secretRow(page, "old-token")).toMatch(
        new RegExp(`^old-token No agent declares it · version 1, set on ${TIME} Not used$`),
      );
      expect([ask.status, removed.status]).toEqual([403, 403]);
      expect(ask.text).toContain(REFUSED);
      expect(removed.text).toContain(REFUSED);
    },
  );

  await then('the store still holds "old-token", and the page of "ada@acme.dev" offers "Delete" for it', async () => {
    expect(await store.bao.read("old-token")).toMatchObject({ version: 1, data: { value: VALUE } });
    const admin = await sut.pages.open("/secrets", { headers: ADMIN });
    expect(links(admin.getByRole("list", { name: "Secrets" }))).toContainEqual({
      href: "/secrets/delete?name=old-token",
      text: "Delete old-token",
    });
  });
});
