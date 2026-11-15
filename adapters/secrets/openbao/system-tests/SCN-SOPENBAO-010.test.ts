import { scenario } from "@opensoftware/testkit";
import { type Store, store } from "./store.ts";

scenario("SCN-SOPENBAO-010", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and a token whose policy may only write values", async () => {
    box = await store(sut, fakes);
    token = await box.bao.token(`path "${box.bao.mount}/data/*" { capabilities = ["create", "update"] }`);
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "exists linear-token" with that token', async () => {
    run = await box.run(token, ["exists", "linear-token"]);
  });

  await then("exists exits with code 1 and the error 'the token may not read \"linear-token\"'", async () => {
    expect([run.exitCode, run.stdout, run.stderr]).toEqual([
      1,
      "",
      'secrets-openbao: the token may not read "linear-token"\n',
    ]);
  });
});
