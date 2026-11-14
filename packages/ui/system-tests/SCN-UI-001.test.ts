import { scenario } from "@opensoftware/testkit";
import { text } from "@opensoftware/ui";
import { themes } from "./tokens.ts";

const COLOURS = [
  "--osf-bg-ground",
  "--osf-bg-surface",
  "--osf-bg-raised",
  "--osf-line",
  "--osf-line-strong",
  "--osf-text",
  "--osf-text-muted",
  "--osf-text-subtle",
  "--osf-signal",
  "--osf-on-signal",
  "--osf-state-running",
  "--osf-state-waiting",
  "--osf-state-failed",
  "--osf-state-complete",
  "--osf-state-cancelled",
];

scenario("SCN-UI-001", async ({ given, when, then }) => {
  let name: Parameters<typeof text>[0];
  await given('the files of "@opensoftware/ui"', async () => {
    name = "tokens";
  });

  let read: ReturnType<typeof themes>;
  await when('a page reads the tokens of "files.tokens"', async () => {
    read = themes(text(name));
  });

  await then(
    "the dark theme defines the backgrounds, lines, texts, the signal, the five states, the two faces, the type sizes, the spaces, the radii and the motion",
    async () => {
      const names = [...read.dark.keys()];
      expect(names).toEqual(expect.arrayContaining(COLOURS));
      expect(read.dark.get("--osf-font-sans")).toMatch(/^"IBM Plex Sans"/);
      expect(read.dark.get("--osf-font-mono")).toMatch(/^"IBM Plex Mono"/);
      expect(names.filter((name) => name.startsWith("--osf-size-"))).toHaveLength(5);
      expect(names.filter((name) => name.startsWith("--osf-space-")).map((name) => read.dark.get(name))).toEqual([
        "4px",
        "8px",
        "12px",
        "16px",
        "24px",
        "32px",
      ]);
      expect([read.dark.get("--osf-radius-control"), read.dark.get("--osf-radius-panel")]).toEqual(["4px", "6px"]);
      expect(read.dark.get("--osf-motion")).toBe("120ms ease-out");
      expect(read.dark.get("--osf-signal")).toBe("#ff6b1a");
    },
  );

  await then("the light theme defines every colour of the dark theme again, and no other name", async () => {
    expect([...read.light.keys()].sort()).toEqual([...COLOURS].sort());
    expect(read.light.get("--osf-signal")).toBe("#c4400a");
  });
});
