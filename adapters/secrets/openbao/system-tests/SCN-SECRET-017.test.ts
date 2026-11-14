import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-017", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the read token", async () => {
    box = await store(sut, fakes);
    token = await box.token("read");
  });

  await given('another client stored "linear-token" in the test store', async () => {
    await box.bao.write("linear-token", { value: VALUE });
  });

  let put: Awaited<ReturnType<Store["run"]>>;
  let list: Awaited<ReturnType<Store["run"]>>;
  let remove: Awaited<ReturnType<Store["run"]>>;
  await when(
    'the client pipes "lin_test_51c2" into "put linear-token --by ada", and runs "list" and "delete linear-token"',
    async () => {
      put = await box.run(token, ["put", "linear-token", "--by", "ada"], { stdin: VALUE });
      list = await box.run(token, ["list"]);
      remove = await box.run(token, ["delete", "linear-token"]);
    },
  );

  await then("put exits with code 1 and the error 'the token may not write \"linear-token\"'", async () => {
    expect([put.exitCode, put.stderr]).toEqual([1, 'secrets-openbao: the token may not write "linear-token"\n']);
  });

  await then('list exits with code 1 and the error "the token may not list the secrets"', async () => {
    expect([list.exitCode, list.stderr]).toEqual([1, "secrets-openbao: the token may not list the secrets\n"]);
  });

  await then("delete exits with code 1 and the error 'the token may not delete \"linear-token\"'", async () => {
    expect([remove.exitCode, remove.stderr]).toEqual([1, 'secrets-openbao: the token may not delete "linear-token"\n']);
    expect(await box.bao.read("linear-token")).toEqual({ version: 1, data: { value: VALUE } });
  });
});
