// `osf profile-pins`: writes the released versions into the Compose profile and the Helm chart (ADR 0095), as
// PROFILE expects them. The release workflow runs it in the release pull request, so each release moves the pins.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMPOSE, pins } from "../checks/lib/profile.ts";
import { Repo } from "../checks/lib/repo.ts";

export function profilePins(root: string): number {
  const repo = new Repo(root);
  if (!repo.exists(COMPOSE)) {
    process.stderr.write(`${COMPOSE} is missing\n`);
    return 1;
  }
  const wanted = pins(repo);
  for (const [file, text] of wanted.files) {
    if (!repo.exists(file) || repo.read(file) === text) continue;
    writeFileSync(join(root, file), text);
    process.stdout.write(`wrote ${file}\n`);
  }
  for (const [module, tag] of wanted.tags) process.stdout.write(`${module} ${tag}\n`);
  return 0;
}
