import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./server.ts";

scenario("SCN-INTAKE-042", async ({ sut, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given("the server runs", async () => {
    server = await serving(sut);
  });

  const post = (json: string) =>
    server.api().POST("/v1/work-items", {
      body: null as never,
      headers: { ...AUTH, "content-type": "application/json" },
      bodySerializer: () => json,
    });
  let list: Awaited<ReturnType<typeof post>>;
  let nothing: Awaited<ReturnType<typeof post>>;
  let number: Awaited<ReturnType<typeof post>>;
  await when('a program posts the JSON values "[]", "null" and "7" to "/v1/work-items"', async () => {
    list = await post("[]");
    nothing = await post("null");
    number = await post("7");
  });

  await then(
    'each answer has the status 400 and the problem "The request is not a work submission" with the detail "the submission is not a JSON object"',
    async () => {
      const problem = {
        status: 400,
        title: "The request is not a work submission",
        detail: "the submission is not a JSON object",
      };
      expect([list.response.status, nothing.response.status, number.response.status]).toEqual([400, 400, 400]);
      expect(list.error).toMatchObject(problem);
      expect(nothing.error).toMatchObject(problem);
      expect(number.error).toMatchObject(problem);
    },
  );
});
