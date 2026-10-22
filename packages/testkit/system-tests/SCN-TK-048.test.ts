import { scenario } from "@opensoftware/testkit";
import { readmeSection } from "@opensoftware/testkit/readme";

scenario("SCN-TK-048", async ({ given, when, then }) => {
  let readme: string;
  await given('a README with the sections "Usage" and "Configuration"', async () => {
    readme = ["# demo", "", "## Usage", "", "Run it.", "", "## Configuration", "", "None.", ""].join("\n");
  });

  let section: string;
  await when('the program asks for the section "Quick start"', async () => {
    section = readmeSection(readme, "Quick start");
  });

  await then("it gets an empty text", async () => {
    expect(section).toBe("");
  });
});
