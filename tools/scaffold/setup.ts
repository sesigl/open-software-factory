// osf init, up and doctor: from a clone to a healthy factory on the Compose profile in deploy/compose/ (T-30,
// ADR 0119). Only Node's own modules, so that the three commands run on a clone without `make install`.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PROFILE = "deploy/compose";
const ENV = `${PROFILE}/.env`;
// The secrets that only the factory's own services share: init generates them. Every other value is the team's.
// OpenBao's unseal key, its root token and the IDs of its two tokens are 64 hex digits too (ADR 0145).
const GENERATED =
  /^(?:[A-Z0-9_]*_PASSWORD|[A-Z0-9_]*_API_TOKEN|[A-Z0-9_]*_MASTER_KEY|[A-Z0-9_]*_SESSION_SECRET|OSF_OPENBAO_UNSEAL_KEY|OSF_OPENBAO_[A-Z]+_TOKEN)$/;
const SLACK = ["GATEKEEPER_SLACK_CHANNEL", "GATEKEEPER_SLACK_TOKEN", "GATEKEEPER_SLACK_SIGNING_SECRET"];
// The settings that the console's own sign-in needs, by provider (ADR 0134).
const SIGN_IN: Record<string, string[]> = {
  oidc: ["CONSOLE_SESSION_SECRET", "CONSOLE_OIDC_ISSUER", "CONSOLE_OIDC_CLIENT_ID", "CONSOLE_OIDC_CLIENT_SECRET"],
  github: ["CONSOLE_SESSION_SECRET", "CONSOLE_GITHUB_CLIENT_ID", "CONSOLE_GITHUB_CLIENT_SECRET"],
};

export function init(root: string, args: string[]): number {
  const at = args.indexOf("--factory");
  const factory = at === -1 ? undefined : args[at + 1];
  if (at !== -1 && !factory) {
    process.stderr.write("osf init --factory needs a folder, like --factory team/factory\n");
    return 2;
  }
  const env = join(root, ENV);
  const lines = readFileSync(join(root, `${PROFILE}/.env.example`), "utf8").split("\n");
  if (existsSync(env)) {
    // A value that a newer profile generates, like OpenBao's key, is added; every value of the .env stays.
    const text = readFileSync(env, "utf8");
    const have = parse(text);
    const missing = lines.filter((line) => GENERATED.test(nameOf(line)) && !have.has(nameOf(line))).map(generate);
    if (missing.length > 0) writeFileSync(env, `${text.replace(/\n?$/, "\n")}${missing.join("\n")}\n`);
    const names = missing.map(nameOf).join(", ");
    process.stdout.write(`${ENV} exists: kept it${names ? `, and added ${names}` : ""}\n`);
  } else {
    writeFileSync(env, lines.map(generate).join("\n"), { mode: 0o600 });
    process.stdout.write(`wrote ${ENV} with the factory's own secrets\n`);
  }
  if (factory) {
    cpSync(join(root, PROFILE, "factory"), resolve(root, factory), { recursive: true });
    const dir = relative(join(root, PROFILE), resolve(root, factory));
    writeFileSync(env, setValue(readFileSync(env, "utf8"), "FACTORY_DIR", dir));
    process.stdout.write(`copied the reference factory to ${factory}; FACTORY_DIR=${dir}\n`);
  }
  const values = parse(readFileSync(env, "utf8"));
  const empty = [...values].filter(([, value]) => value === "").map(([name]) => name);
  const groups = factory ? `${factory}/groups.json` : `${PROFILE}/factory/groups.json`;
  process.stdout.write(
    [
      "Next:",
      `  set in ${ENV} what your factory uses: ${empty.join(", ") || "nothing is empty"}`,
      `  put your approvers in ${groups} in place of slack:U0EXAMPLE`,
      "  osf up, then osf doctor",
      "",
    ].join("\n"),
  );
  return 0;
}

export function up(root: string, args: string[]): number {
  const env = join(root, ENV);
  if (!existsSync(env)) {
    process.stdout.write(`${ENV} is missing: run osf init\n`);
    return 1;
  }
  const values = parse(readFileSync(env, "utf8"));
  const compose = readFileSync(join(root, PROFILE, "compose.yaml"), "utf8");
  const required = new Set([...compose.matchAll(/\$\{([A-Z0-9_]+):\?/g)].map((match) => match[1] as string));
  const problems = [...required].filter((name) => !values.get(name)).map((name) => `set ${name} in ${ENV}`);
  if (!values.get("GATEKEEPER_FORGE_TOKEN") && SLACK.some((name) => !values.get(name))) {
    problems.push(`set ${SLACK[0]}, ${SLACK[1]} and ${SLACK[2]}, or GATEKEEPER_FORGE_TOKEN, in ${ENV}`);
  }
  const signIn = values.get("CONSOLE_SIGN_IN");
  if (signIn) {
    const needs = SIGN_IN[signIn];
    if (!needs) problems.push(`set CONSOLE_SIGN_IN in ${ENV} to oidc or github, not ${signIn}`);
    for (const name of needs ?? [])
      if (!values.get(name)) problems.push(`set ${name} in ${ENV}: CONSOLE_SIGN_IN=${signIn} needs it`);
  }
  for (const problem of problems) process.stdout.write(`${problem}\n`);
  if (problems.length > 0) return 1;
  return docker(root, ["compose", "up", "--detach", "--wait", ...args]);
}

export function doctor(root: string): number {
  return docker(root, ["compose", "run", "--rm", "console", "console", "doctor"]);
}

function docker(root: string, args: string[]): number {
  const command = process.env.OSF_DOCKER || "docker";
  const run = spawnSync(command, args, { cwd: join(root, PROFILE), stdio: "inherit" });
  if (run.error) {
    process.stderr.write(`${command} did not start: ${run.error.message}. Install Docker with Compose 2.24 or later\n`);
    return 1;
  }
  return run.status ?? 1;
}

const nameOf = (line: string): string => /^([A-Z0-9_]+)=/.exec(line)?.[1] ?? "";

function generate(line: string): string {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (!match || !GENERATED.test(match[1] as string)) return line;
  const prefix = match[2] as string;
  return `${match[1]}=${prefix}${randomBytes(32).toString("hex")}`;
}

function parse(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values.set(match[1] as string, (match[2] as string).trim());
  }
  return values;
}

function setValue(text: string, name: string, value: string): string {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
}
