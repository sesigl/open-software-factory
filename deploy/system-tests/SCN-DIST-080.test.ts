import { type CliResult, scenario } from "@opensoftware/testkit";

const REGISTRY = "ghcr.io/sesigl/open-software-factory/";

scenario("SCN-DIST-080", async ({ sut, fakes, given, when, then }) => {
  let pinned: string[] = [];
  await given(
    'the Compose profile "compose/compose.yaml" with the images of the factory\'s registry that it pins',
    async () => {
      const text = fakes.fromRepository("deploy/compose")["compose.yaml"] as string;
      const images = [...text.matchAll(/^\s+image:\s*(\S+)\s*$/gm)].map((image) => image[1] as string);
      pinned = [...new Set(images)].filter((image) => image.startsWith(REGISTRY));
      expect(pinned.length).toBeGreaterThan(5);
    },
  );

  let run: CliResult;
  await when('the operator runs "node scripts/images.ts --dry-run" with "OSF_DEPLOY_IMAGES=released"', async () => {
    run = await sut.cli(["--dry-run"], { env: { OSF_DEPLOY_IMAGES: "released" } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  const lines = () => run.stdout.split("\n");
  await then(
    'the output has the line "images: docker pull <image>" once for each image of "ghcr.io/sesigl/open-software-factory/" that "compose.yaml" pins',
    async () => {
      const pulls = lines().filter((line) => line.startsWith(`images: docker pull ${REGISTRY}`));
      expect(pulls.sort()).toEqual(pinned.map((image) => `images: docker pull ${image}`).sort());
    },
  );

  await then(
    'the output has the line "images: the released images that compose.yaml pins, so none is built"',
    async () => {
      expect(lines()).toContain("images: the released images that compose.yaml pins, so none is built");
    },
  );

  await then('no line of the output names "images/.workspace" or a bake', async () => {
    expect(run.stdout + run.stderr).not.toMatch(/\.workspace|bake/);
  });
});
