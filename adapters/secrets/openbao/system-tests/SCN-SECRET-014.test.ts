import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-014", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client pipes "lin_test_51c2" into "put linear-token"', async () => {
    run = await box.run(token, ["put", "linear-token"], { stdin: VALUE });
  });

  await then(
    'put exits with code 2 and the error "name the person of the change, like put linear-token --by ada"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toBe("secrets-openbao: name the person of the change, like put linear-token --by ada\n");
      expect(await box.bao.read("linear-token")).toBeUndefined();
    },
  );
});
