import { readSpec } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { catching } from "./egress.ts";

scenario("SCN-SEGRESS-011", async ({ sut, given, when, then }) => {
  let file = "";
  await given('the file "spec.json" with a sandbox spec whose CPU is "four"', async () => {
    await sut.files.put("$INPUT/spec.json", JSON.stringify({ template: "alpine", cpu: "four" }));
    file = sut.files.path("$INPUT/spec.json");
  });

  let error: unknown;
  await when("the adapter calls readSpec with the file", async () => {
    error = catching(() => readSpec(file));
  });

  await then('it fails with a usage error that names "spec.json: /cpu"', async () => {
    expect((error as Error).constructor.name).toBe("UsageError");
    expect((error as Error).message).toBe(`${file}: /cpu must be number`);
  });
});
