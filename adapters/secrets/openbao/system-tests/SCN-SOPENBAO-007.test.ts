import { scenario } from "@opensoftware/testkit";
import { type Store, store } from "./store.ts";

scenario("SCN-SOPENBAO-007", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "probe" with the store\'s address and a final "/"', async () => {
    run = await box.run(token, ["probe"], { env: { OSF_OPENBAO_ADDR: `${box.bao.url}/` } });
  });

  await then("probe exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toHaveProperty("ttl");
  });
});
