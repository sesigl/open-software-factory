import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN, type Store, servingSecrets } from "./secrets.ts";

scenario("SCN-CONSOLE-183", async ({ sut, fakes, given, when, then }) => {
  let store: Store;
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"',
    async () => {
      store = await servingSecrets(sut, fakes, { triage: { secrets: ["ref:openbao/linear-token"] } });
    },
  );

  let page: Page;
  await when('"ada@acme.dev" sends a value of 70000 characters for "linear-token"', async () => {
    page = await sut.pages.send("/secrets", { name: "linear-token", value: "x".repeat(70_000) }, { headers: ADMIN });
  });

  await then('the page answers 413 and says "Not stored: the form is over its limit of 64 KiB"', async () => {
    expect(page.status).toBe(413);
    expect(page.getByRole("alert").text).toBe("Not stored: the form is over its limit of 64 KiB");
  });

  await then('the store holds no value of "linear-token"', async () => {
    expect(await store.bao.read("linear-token")).toBeUndefined();
  });
});
