import { scenario } from "@opensoftware/testkit";
import { foreman, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-013", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with no runs and "CONSOLE_FOREMAN_TOKEN" set to "foreman-token-1"', async () => {
    api = await foreman(fakes, []);
  });

  await when('a person opens "/"', async () => {
    await serving(sut, [api.url], { CONSOLE_FOREMAN_TOKEN: "foreman-token-1" });
    await open(sut, "/");
  });

  await then('the foreman received "/v1/runs" with "Authorization: Bearer foreman-token-1"', async () => {
    expect(api.headers().map((request) => [request.path, request.headers.authorization])).toEqual([
      ["/v1/runs", "Bearer foreman-token-1"],
    ]);
  });
});
