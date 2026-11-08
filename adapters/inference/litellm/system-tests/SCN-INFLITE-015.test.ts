import { scenario } from "@opensoftware/testkit";
import { attached, cli, keyProxy, runKey } from "./proxy.ts";

const ID = /^[0-9a-f]{12}$/;

scenario("SCN-INFLITE-015", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof keyProxy>>;
  await given(
    'a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", and "/key/delete"',
    async () => {
      proxy = await keyProxy(fakes);
    },
  );

  const ids: string[] = [];
  await given('two gateways attached to the test proxy, and a key of the first one for the run "run-7"', async () => {
    for (let index = 0; index < 2; index++) ids.push((await attached(sut, proxy.url)).id);
    await runKey(sut, ids[0] as string, "run-7");
  });

  let first: Awaited<ReturnType<typeof cli>>;
  let second: Awaited<ReturnType<typeof cli>>;
  await when('the client runs "list", and "list" with "OSF_DATA" set to a folder that does not exist', async () => {
    first = await cli(sut, ["list"]);
    second = await cli(sut, ["list"], undefined, { OSF_DATA: "no-such-folder" });
  });

  await then(
    "each line of the first list is an ID of 12 hex digits, the lines are in order, and each ID is there once",
    async () => {
      expect(first.exitCode, first.stderr).toBe(0);
      const lines = first.stdout.trimEnd().split("\n");
      for (const line of lines) expect(line).toMatch(ID);
      expect(lines).toEqual([...lines].sort());
      expect(new Set(lines).size).toBe(lines.length);
    },
  );

  await then("the first list has the IDs of both gateways", async () => {
    expect(first.stdout.split("\n")).toEqual(expect.arrayContaining(ids));
  });

  await then(
    "each line of the second list is an ID of 12 hex digits, and neither of the two IDs is there",
    async () => {
      expect(second.exitCode, second.stderr).toBe(0);
      const lines = second.stdout.split("\n").filter(Boolean);
      for (const line of lines) expect(line).toMatch(ID);
      for (const id of ids) expect(lines).not.toContain(id);
    },
  );
});
