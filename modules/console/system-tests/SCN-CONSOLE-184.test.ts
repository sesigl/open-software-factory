import { type Page, scenario } from "@opensoftware/testkit";
import { links } from "./console.ts";
import { ADMIN, type Store, servingSecrets, VALUE } from "./secrets.ts";

scenario("SCN-CONSOLE-184", async ({ sut, fakes, given, when, then }) => {
  let store: Store;
  await given(
    'a factory whose agents declare no secret, and a store in which another program stored "sentry-token"',
    async () => {
      store = await servingSecrets(sut, fakes, { triage: {} });
      await store.bao.write("sentry-token", { value: VALUE });
    },
  );

  let asks: Page;
  let deleted: Page;
  let list: Page;
  await when(
    'the admin follows "Delete sentry-token" on "/secrets" and presses "Delete" on the page that asks',
    async () => {
      asks = await (await sut.pages.open("/secrets", { headers: ADMIN })).follow("Delete sentry-token");
      deleted = await asks.submit("Delete", {}, { follow: false });
      list = await sut.pages.open(deleted.location ?? "", { headers: ADMIN });
    },
  );

  await then(
    'the page that asked has the heading "Delete sentry-token?" and the link "Cancel" to "/secrets"',
    async () => {
      expect([asks.status, asks.path]).toEqual([200, "/secrets/delete?name=sentry-token"]);
      expect(asks.getByRole("heading", { level: 1 }).text).toBe("Delete sentry-token?");
      expect(asks.getByText(/^This removes/).text).toBe(
        "This removes sentry-token with every version from the store. An agent that declares ref:openbao/sentry-token gets no value for it in its next sandbox, until someone stores a new one.",
      );
      expect(links(asks.getByRole("main")).filter((link) => link.text === "Cancel")).toEqual([
        { href: "/secrets", text: "Cancel" },
      ]);
    },
  );

  await then('the console answered 303 to "/secrets", which says "No secrets yet"', async () => {
    expect([deleted.status, deleted.location]).toEqual([303, "/secrets"]);
    expect(list.getByText(/^No secrets yet/).text).toBe(
      "No secrets yet. An agent declares one in the factory definition, like ref:openbao/linear-token.",
    );
  });

  await then('the store holds no value of "sentry-token"', async () => {
    expect(await store.bao.read("sentry-token")).toBeUndefined();
  });
});
