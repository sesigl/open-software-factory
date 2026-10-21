import { outputPath } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-012", async ({ given, when, then }) => {
  let variables: Record<string, string>;
  await given('the environment variable "OUTPUT" is "/work/output"', async () => {
    variables = { OUTPUT: "/work/output" };
  });

  let path: string;
  await when('the module asks for the output path of "report.json"', async () => {
    path = outputPath("report.json", undefined, variables);
  });

  await then('it gets "/work/output/report.json"', async () => {
    expect(path).toBe("/work/output/report.json");
  });
});
