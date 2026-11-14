import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SOPENBAO-009", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the read token", async () => {
    box = await store(sut, fakes);
    token = await box.token("read");
  });

  await given(
    'another client stored "deleted-token" and "destroyed-token", then deleted the current version of the first and destroyed that of the second',
    async () => {
      await box.bao.write("deleted-token", { value: VALUE });
      await box.bao.write("destroyed-token", { value: VALUE });
      // Another client of OpenBao, with a token that may delete and destroy versions, as OpenBao's own CLI does.
      const { mount, url } = box.bao;
      const other = await box.bao.token(
        `path "${mount}/data/*" { capabilities = ["delete"] }\npath "${mount}/destroy/*" { capabilities = ["update"] }`,
      );
      const headers = { "x-vault-token": other };
      const deleted = await fetch(`${url}/v1/${mount}/data/deleted-token`, { method: "DELETE", headers });
      const body = JSON.stringify({ versions: [1] });
      const destroyed = await fetch(`${url}/v1/${mount}/destroy/destroyed-token`, { method: "PUT", headers, body });
      if (deleted.status !== 204 || destroyed.status !== 204)
        throw new Error(`OpenBao answered ${deleted.status} and ${destroyed.status}`);
    },
  );

  let runs: Awaited<ReturnType<Store["run"]>>[] = [];
  await when('the client runs "exists deleted-token" and "exists destroyed-token" with the read token', async () => {
    runs = [await box.run(token, ["exists", "deleted-token"]), await box.run(token, ["exists", "destroyed-token"])];
  });

  await then('exists prints "exists" false for both', async () => {
    expect(runs.map((run) => [run.exitCode, run.stdout])).toEqual([
      [0, '{"name":"deleted-token","exists":false}\n'],
      [0, '{"name":"destroyed-token","exists":false}\n'],
    ]);
  });
});
