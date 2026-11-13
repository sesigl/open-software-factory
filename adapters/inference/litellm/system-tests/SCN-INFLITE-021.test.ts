import { scenario } from "@opensoftware/testkit";
import { attached, cli } from "./proxy.ts";

scenario("SCN-INFLITE-021", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a test proxy that answers "/key/list", and "/key/generate" with the status 400 and the error "max_budget must be a number" for "max_budget"',
    async () => {
      proxy = await fakes.http([
        { path: "/key/list?size=1", body: { keys: [] } },
        {
          method: "POST",
          path: "/key/generate",
          status: 400,
          body: { error: { message: "max_budget must be a number", type: "bad_request_error", param: "max_budget" } },
        },
      ]);
    },
  );

  let gateway = { id: "", url: "" };
  await given("a gateway attached to the test proxy", async () => {
    gateway = await attached(sut, proxy.url);
  });

  let key: Awaited<ReturnType<typeof cli>>;
  await when('the client runs "key" for the run "run-7"', async () => {
    key = await cli(sut, ["key", gateway.id, "run-7"]);
  });

  await then(
    'key exits with code 1 with an error that names "/key/generate", the status 400 and "max_budget must be a number"',
    async () => {
      expect(key.exitCode).toBe(1);
      expect(key.stderr).toMatch(/\/key\/generate.*400.*max_budget must be a number/);
    },
  );

  await then("key prints nothing on standard output", async () => {
    expect(key.stdout).toBe("");
  });
});
