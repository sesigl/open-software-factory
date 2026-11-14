import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-018", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let refused: Awaited<ReturnType<Store["run"]>>[] = [];
  await when(
    'the client pipes "lin_test_51c2" into "put linear-token" with a person of 129 characters, and with the person "ada", a line break and "grace"',
    async () => {
      refused = [
        await box.run(token, ["put", "linear-token", "--by", "a".repeat(129)], { stdin: VALUE }),
        await box.run(token, ["put", "linear-token", "--by", "ada\ngrace"], { stdin: VALUE }),
      ];
    },
  );

  let longest: Awaited<ReturnType<Store["run"]>>;
  await when('the client pipes "lin_test_51c2" into "put team/longest" with a person of 128 characters', async () => {
    longest = await box.run(token, ["put", "team/longest", "--by", "a".repeat(128)], { stdin: VALUE });
  });

  await then(
    'both puts of "linear-token" exit with code 2 and the error "name the person in at most 128 characters, without a line break or another control character"',
    async () => {
      const error =
        "secrets-openbao: name the person in at most 128 characters, without a line break or another control character\n";
      expect(refused.map((run) => [run.exitCode, run.stderr, run.stdout])).toEqual(Array(2).fill([2, error, ""]));
    },
  );

  await then('the test store holds no secret "linear-token"', async () => {
    expect(await box.bao.read("linear-token")).toBeUndefined();
  });

  await then('put of "team/longest" prints the version 1', async () => {
    expect(longest.exitCode, longest.stderr).toBe(0);
    expect(longest.stdout).toBe('{"name":"team/longest","version":1}\n');
  });
});
