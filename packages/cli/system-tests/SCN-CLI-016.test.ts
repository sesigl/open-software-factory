import { outputPath } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-016", async ({ given, when, then }) => {
  let variables: Record<string, string>;
  await given('no environment variable "OUTPUT"', async () => {
    variables = {};
  });

  let path: string;
  await when('the module asks for the output path of "report.json"', async () => {
    path = outputPath("report.json", undefined, variables);
  });

  await then('it gets "report.json"', async () => {
    expect(path).toBe("report.json");
  });
});
