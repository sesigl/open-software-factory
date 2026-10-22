import { scenario } from "@opensoftware/testkit";
import { documentedEnv } from "@opensoftware/testkit/readme";

scenario("SCN-TK-047", async ({ given, when, then }) => {
  let readme: string;
  await given(
    'a README that names `DEMO_HOME` and `DEMO_URL` under "## Configuration" and `OTHER_VAR` under "## Usage"',
    async () => {
      readme = [
        "# demo",
        "",
        "## Configuration",
        "",
        "| `DEMO_HOME` | Where demo keeps its data. |",
        "| `DEMO_URL` | The API. |",
        "",
        "## Usage",
        "",
        "Set `OTHER_VAR` to try it.",
        "",
      ].join("\n");
    },
  );

  let names: Set<string>;
  await when("the program asks for the documented environment variables", async () => {
    names = documentedEnv(readme);
  });

  await then('it gets "DEMO_HOME" and "DEMO_URL"', async () => {
    expect([...names]).toEqual(["DEMO_HOME", "DEMO_URL"]);
  });
});
