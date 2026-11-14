import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SOPENBAO-003", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let runs: { mount: string; run: Awaited<ReturnType<Store["run"]>> }[] = [];
  await when(
    'the client runs "probe" and pipes a value into "put linear-token --by ada" with the mount "cubbyhole", and runs "probe" with the mount "missing"',
    async () => {
      // Every token may use its own "cubbyhole", a mount of another kind; no token may use "missing".
      const env = (mount: string) => ({ OSF_OPENBAO_MOUNT: mount });
      runs = [
        { mount: "cubbyhole", run: await box.run(token, ["probe"], { env: env("cubbyhole") }) },
        {
          mount: "cubbyhole",
          run: await box.run(token, ["put", "linear-token", "--by", "ada"], { env: env("cubbyhole"), stdin: VALUE }),
        },
        { mount: "missing", run: await box.run(token, ["probe"], { env: env("missing") }) },
      ];
    },
  );

  await then(
    "each exits with code 1 and the error 'OpenBao has no KV version 2 mount \"<mount>\" that the token may use' for its mount",
    async () => {
      const refused = (mount: string) => [
        1,
        `secrets-openbao: OpenBao has no KV version 2 mount "${mount}" that the token may use\n`,
        "",
      ];
      expect(runs.map(({ run }) => [run.exitCode, run.stderr, run.stdout])).toEqual(
        runs.map(({ mount }) => refused(mount)),
      );
    },
  );
});
