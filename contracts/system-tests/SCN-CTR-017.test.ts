import { readDocument } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-017", async ({ sut, given, when, then }) => {
  let file = "";
  await given('the file "spec.json" with a sandbox spec whose CPU is "four"', async () => {
    await sut.files.put("$INPUT/spec.json", JSON.stringify({ template: "alpine", cpu: "four" }));
    file = sut.files.path("$INPUT/spec.json");
  });

  let read: ReturnType<typeof readDocument> | undefined;
  await when('the adapter calls readDocument with "sandbox-spec" and the file', async () => {
    read = readDocument("sandbox-spec", file);
  });

  await then("the document is the spec in the file", async () => {
    expect(read?.document).toEqual({ template: "alpine", cpu: "four" });
  });

  await then('the one problem is "/cpu" "must be number"', async () => {
    expect(read?.problems).toEqual([{ path: "/cpu", message: "must be number" }]);
  });
});
