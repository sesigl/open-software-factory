import { scenario } from "@opensoftware/testkit";
import { documentedEnv, isDocumented } from "@opensoftware/testkit/readme";

scenario("SCN-TK-079", async ({ given, when, then }) => {
  let readme = "";
  await given('a README that names `OSF_SECRET_*` under "## Configuration"', async () => {
    readme = ["# demo", "", "## Configuration", "", "| `OSF_SECRET_*` | The value of ref:env/<NAME>. |", ""].join("\n");
  });

  let answers: boolean[] = [];
  await when('the program asks whether "OSF_SECRET_LINEAR_TOKEN" and "OSF_SECRETS_DIR" are documented', async () => {
    const documented = documentedEnv(readme);
    answers = [isDocumented(documented, "OSF_SECRET_LINEAR_TOKEN"), isDocumented(documented, "OSF_SECRETS_DIR")];
  });

  await then('"OSF_SECRET_LINEAR_TOKEN" is documented and "OSF_SECRETS_DIR" is not', async () => {
    expect(answers).toEqual([true, false]);
  });
});
