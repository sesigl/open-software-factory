import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./foreman.ts";

scenario("SCN-FORE-005", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/runs/run_00000000000000000000" with the API token', async () => {
    answer = await sut.http.request("GET", "/v1/runs/run_00000000000000000000", { headers: AUTH });
  });

  await then('the answer has the status 404 and a problem that names "run_00000000000000000000"', async () => {
    expect(answer.status).toBe(404);
    expect(answer.headers["content-type"]).toContain("application/problem+json");
    expect(answer.body).toMatchObject({
      title: "No such run",
      status: 404,
      detail: expect.stringContaining("run_00000000000000000000"),
    });
    expect(server.harness.prompts()).toEqual([]);
  });
});
