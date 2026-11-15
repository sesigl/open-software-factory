import { scenario } from "@opensoftware/testkit";
import { type Store, store } from "./store.ts";

scenario("SCN-SOPENBAO-004", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client pipes a value of 33 MiB into "put linear-token --by ada"', async () => {
    // OpenBao's listener refuses a request over 32 MiB (max_request_size).
    run = await box.run(token, ["put", "linear-token", "--by", "ada"], { stdin: "x".repeat(33 * 1024 * 1024) });
  });

  await then(
    'put exits with code 1 and an error that starts with "OpenBao answered POST" and names the status 413',
    async () => {
      expect(run.exitCode, run.stderr.slice(0, 500)).toBe(1);
      expect(run.stderr).toBe(
        `secrets-openbao: OpenBao answered POST ${box.bao.mount}/data/linear-token with 413: {"errors":["http: request body too large"]}\n`,
      );
    },
  );

  await then('the test store holds no secret "linear-token"', async () => {
    expect(await box.bao.read("linear-token")).toBeUndefined();
  });
});
