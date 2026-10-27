// `make install` step: the pinned lychee (DOCS-LINKS), oasdiff (CONTRACT), opa (gatekeeper's policies, ADR 0047),
// temporal and nats-server (the servers of `fakes.temporal()` and `fakes.nats()`, ADR 0067), and helm, kubectl and
// kind (the Helm chart's scenarios, ADR 0075) binaries, checked against their SHA-256, in .tools/bin. Releases exist
// for Linux x86_64 here; elsewhere put the same versions on PATH.
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
  /** The download is the binary itself, not a .tar.gz archive. */
  binary?: boolean;
  /** The binary's path inside the archive, when it is not `name` at its top. */
  member?: string;
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
  {
    name: "opa",
    version: "1.21.0",
    url: "https://github.com/open-policy-agent/opa/releases/download/v1.21.0/opa_linux_amd64_static",
    sha256: "5eef70644868bb04d0556bcc795ee42f2ab379e73f51d1bfa30f83e1305bc9b9",
    binary: true,
  },
  {
    name: "temporal",
    version: "1.4.1",
    url: "https://github.com/temporalio/cli/releases/download/v1.4.1/temporal_cli_1.4.1_linux_amd64.tar.gz",
    sha256: "e2063feade24d90cec1590dd9a46b0ccf838433b013738a348af1c01a9cb3874",
  },
  {
    name: "nats-server",
    version: "2.11.9",
    url: "https://github.com/nats-io/nats-server/releases/download/v2.11.9/nats-server-v2.11.9-linux-amd64.tar.gz",
    sha256: "3eef83faa048d3879937a6871f59ae5d9c3bbf5900905b7a9ff996a894d755ab",
    member: "nats-server-v2.11.9-linux-amd64/nats-server",
  },
  {
    name: "helm",
    version: "4.3.1",
    url: "https://get.helm.sh/helm-v4.3.1-linux-amd64.tar.gz",
    sha256: "0403a88ae20913d11b10a2467b50087721fea7581736da6b9d3992f5357fe54b",
    member: "linux-amd64/helm",
  },
  {
    name: "kubectl",
    version: "1.34.1",
    url: "https://dl.k8s.io/release/v1.34.1/bin/linux/amd64/kubectl",
    sha256: "7721f265e18709862655affba5343e85e1980639395d5754473dafaadcaa69e3",
    binary: true,
  },
  {
    name: "kind",
    version: "0.30.0",
    url: "https://github.com/kubernetes-sigs/kind/releases/download/v0.30.0/kind-linux-amd64",
    sha256: "517ab7fc89ddeed5fa65abf71530d90648d9638ef0c4cde22c2c11f8097b8889",
    binary: true,
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
      if (!tool.binary) run("tar", ["-xzf", archive, "-C", temp]);
      copyFileSync(tool.binary ? archive : join(temp, tool.member ?? tool.name), target);
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
