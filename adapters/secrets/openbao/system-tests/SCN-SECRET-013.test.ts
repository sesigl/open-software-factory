import { scenario } from "@opensoftware/testkit";
import { type Store, store } from "./store.ts";

scenario("SCN-SECRET-013", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client pipes "" into "put linear-token --by ada"', async () => {
    run = await box.run(token, ["put", "linear-token", "--by", "ada"], { stdin: "" });
  });

  await then(
    'put exits with code 2 and the error "put reads the value from standard input, and it was empty"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toBe("secrets-openbao: put reads the value from standard input, and it was empty\n");
    },
  );

  await then('the test store holds no secret "linear-token"', async () => {
    expect(await box.bao.read("linear-token")).toBeUndefined();
  });
});
