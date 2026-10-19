// `make install` step: the pinned lychee (DOCS-LINKS) and oasdiff (CONTRACT) binaries, checked against their
// SHA-256, in .tools/bin. Releases exist for Linux x86_64 here; elsewhere put the same versions on PATH.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Pinned {
  name: string;
  version: string;
  url: string;
  sha256: string;
}

const PINNED: Pinned[] = [
  {
    name: "lychee",
    version: "0.20.1",
    url: "https://github.com/lycheeverse/lychee/releases/download/lychee-v0.20.1/lychee-x86_64-unknown-linux-gnu.tar.gz",
    sha256: "1dd08bb064e2114c2c9d0c9009f51577de24e805361d6332162807972d8e9474",
  },
  {
    name: "oasdiff",
    version: "1.11.7",
    url: "https://github.com/oasdiff/oasdiff/releases/download/v1.11.7/oasdiff_1.11.7_linux_amd64.tar.gz",
    sha256: "97f1052365f74e6fd6f4d8fa108606e09391aebb8ecbf3b5e7a4059d54327224",
  },
];

export function installTools(root: string): number {
  const bin = join(root, ".tools", "bin");
  mkdirSync(bin, { recursive: true });
  for (const tool of PINNED) {
    const target = join(bin, tool.name);
    if (existsSync(target)) continue;
    if (process.platform !== "linux" || process.arch !== "x64") {
      process.stderr.write(
        `${tool.name} ${tool.version}: no pinned build for ${process.platform}-${process.arch}; install it on PATH\n`,
      );
      continue;
    }
    const temp = mkdtempSync(join(tmpdir(), "osf-tools-"));
    try {
      const archive = join(temp, "archive.tar.gz");
      run("curl", ["-sSfL", "-o", archive, tool.url]);
      const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
      if (digest !== tool.sha256) throw new Error(`${tool.name}: checksum ${digest} does not match ${tool.sha256}`);
      run("tar", ["-xzf", archive, "-C", temp]);
      copyFileSync(join(temp, tool.name), target);
      chmodSync(target, 0o755);
      process.stdout.write(`installed ${tool.name} ${tool.version}\n`);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
  return 0;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}
