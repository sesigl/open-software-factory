import { outputPath } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-013", async ({ given, when, then }) => {
  let variables: Record<string, string>;
  await given('the environment variable "OUTPUT" is "/work/output"', async () => {
    variables = { OUTPUT: "/work/output" };
  });

  let path: string;
  await when('the module asks for the output path of "report.json" with --out "custom.json"', async () => {
    path = outputPath("report.json", "custom.json", variables);
  });

  await then('it gets "custom.json"', async () => {
    expect(path).toBe("custom.json");
  });
});
