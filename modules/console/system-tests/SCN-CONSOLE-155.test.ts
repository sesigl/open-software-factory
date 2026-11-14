import { scenario } from "@opensoftware/testkit";
import { foreman, serving } from "./console.ts";

scenario("SCN-CONSOLE-155", async ({ sut, fakes, given, when, then }) => {
  let missing = "";
  await given('a console whose "CONSOLE_FACTORY" names a file that does not exist', async () => {
    missing = sut.files.path("$INPUT/no-factory.yaml");
    const api = await foreman(fakes, []);
    await serving(sut, [api.url], { CONSOLE_FACTORY: missing });
  });

  let answer: Awaited<ReturnType<typeof sut.http.get>>;
  await when('a program asks for "/v1/ready"', async () => {
    answer = await sut.http.get("/v1/ready");
  });

  await then('the answer has the status 503 and the status "failing" with a detail that names the file', async () => {
    expect(answer.status).toBe(503);
    expect(answer.body).toEqual({
      status: "failing",
      detail: `ENOENT: no such file or directory, open '${missing}'`,
    });
  });
});
