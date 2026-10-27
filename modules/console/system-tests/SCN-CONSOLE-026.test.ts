import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";

scenario("SCN-CONSOLE-026", async ({ sut, given, when, then }) => {
  await given('"console serve" runs', async () => {
    await serving(sut, ["http://127.0.0.1:1"]);
  });

  let answer: Awaited<ReturnType<typeof sut.http.post>>;
  await when('a program posts to "/factory"', async () => {
    answer = await sut.http.post("/factory", { agents: {} });
  });

  await then("the answer has the status 405", async () => {
    expect(answer.status).toBe(405);
    expect(answer.headers.allow).toBe("GET, HEAD");
  });
});
