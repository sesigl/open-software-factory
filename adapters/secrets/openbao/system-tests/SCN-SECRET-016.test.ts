import { scenario } from "@opensoftware/testkit";
import { type Store, store } from "./store.ts";

scenario("SCN-SECRET-016", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  await given('the test store and the token "osf-test-unknown-token"', async () => {
    box = await store(sut, fakes);
  });

  let runs: Awaited<ReturnType<Store["run"]>>[] = [];
  await when('the client runs "list" and "probe"', async () => {
    runs = [await box.run("osf-test-unknown-token", ["list"]), await box.run("osf-test-unknown-token", ["probe"])];
  });

  await then('each exits with code 1 and the error "the store refused the token"', async () => {
    const error = "secrets-openbao: the store refused the token\n";
    expect(runs.map((run) => [run.exitCode, run.stderr, run.stdout])).toEqual(Array(2).fill([1, error, ""]));
  });
});
