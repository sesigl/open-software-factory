import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN, type Store, secretRow, servingSecrets, TIME, VALUE } from "./secrets.ts";

scenario("SCN-CONSOLE-173", async ({ sut, fakes, given, when, then }) => {
  let store: Store;
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"',
    async () => {
      store = await servingSecrets(sut, fakes, { triage: { secrets: ["ref:openbao/linear-token"] } });
    },
  );

  let answer: Page;
  let list: Page;
  await when(
    '"ada@acme.dev" opens "/secrets", types a value for "linear-token" and presses "Store value"',
    async () => {
      const page = await sut.pages.open("/secrets", { headers: ADMIN });
      answer = await page.submit("Store value", { Name: "linear-token", Value: VALUE }, { follow: false });
      list = await sut.pages.open(answer.location ?? "", { headers: ADMIN });
    },
  );

  await then('the console answered 303 to "/secrets"', async () => {
    expect([answer.status, answer.location]).toEqual([303, "/secrets"]);
  });

  await then(
    'the list says "linear-token" is "Set", "Used by the agent triage · version 1, set by ada@acme.dev on <time>"',
    async () => {
      expect(secretRow(list, "linear-token")).toMatch(
        new RegExp(
          `^linear-token Used by the agent triage · version 1, set by ada@acme\\.dev on ${TIME} Set Replace linear-token$`,
        ),
      );
    },
  );

  await then('the store holds the value as version 1 of "linear-token"', async () => {
    expect(await store.bao.read("linear-token")).toEqual({ version: 1, data: { value: VALUE } });
  });
});
