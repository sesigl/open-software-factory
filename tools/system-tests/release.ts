// Shared steps of the RELEASE scenarios: a workspace with a published and a private module.
import { putAll } from "./repo.ts";

type Sut = Parameters<typeof putAll>[0] & {
  cli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

/** The package.json of a module; `private` leaves it out of npm. */
export const manifest = (name: string, version: string, isPrivate = false): string =>
  `${JSON.stringify({ name: `@opensoftware/${name}`, version, ...(isPrivate ? { private: true } : {}) }, null, 2)}\n`;

/** A workspace with the published module "demo" at 0.3.0, the private module "other" and empty release files. */
export const putModules = (sut: Sut): Promise<void> =>
  putAll(sut, {
    "pnpm-workspace.yaml": "packages:\n  - modules/*\n",
    "modules/demo/package.json": manifest("demo", "0.3.0"),
    "modules/other/package.json": manifest("other", "0.1.0", true),
    "release-please-config.json": '{ "packages": {} }\n',
    ".release-please-manifest.json": "{}\n",
  });

/** release-please.yml whose loop over the release pull requests runs `starts`, the first of them on line 9. */
export const releasePlease = (...starts: string[]): string =>
  [
    "name: release-please",
    "on:",
    "  push:",
    "    branches: [main]",
    "jobs:",
    "  release-please:",
    "    steps:",
    "      - run: |",
    ...starts.map((start) => `          gh workflow run ${start}`),
    "",
  ].join("\n");

/** The start of `file` for the release pull request `$pr`, from main or from the branch in `$BRANCH`. */
export const start = (file: string, ref = "main"): string =>
  `${file} --repo "$GITHUB_REPOSITORY" --ref ${ref} -f pr="$pr"`;

/** A workflow that takes the input pr with workflow_dispatch, or, with `takesPr` false, has no such input. */
export const dispatched = (takesPr = true): string =>
  takesPr
    ? "on:\n  workflow_dispatch:\n    inputs:\n      pr:\n        required: true\njobs: {}\n"
    : "on:\n  pull_request_target:\njobs: {}\n";

export const releaseFiles = (sut: Sut) => sut.cli(["release-files"]);
export const checkRelease = (sut: Sut) => sut.cli(["check", "RELEASE"]);
