// Installs the packages of PACKAGES from the packs beside this file, in /opt/osf, and puts their commands on the PATH,
// as `npm install --global` does with the releases on npm (ADR 0156). images.ts copies it into the image's context.
//   node install.mjs @opensoftware/console@0.12.0 @opensoftware/forge-github@0.8.1 ...
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const names = process.argv.slice(2).map((pin) => {
  const name = pin.slice(0, pin.lastIndexOf("@"));
  const version = pin.slice(pin.lastIndexOf("@") + 1);
  const pack = manifest.overrides[name];
  // PROFILE keeps each pin at the workspace's version, so the pack of a pin has the pin's version.
  if (!pack?.endsWith(`-${version}.tgz`)) throw new Error(`install: the workspace has no pack of ${pin}: ${pack}`);
  return name;
});
manifest.dependencies = Object.fromEntries(names.map((name) => [name, manifest.overrides[name]]));
writeFileSync("package.json", `${JSON.stringify(manifest, null, 2)}\n`);
execFileSync("npm", ["install", "--omit=dev", "--no-fund", "--no-audit"], { stdio: "inherit" });
for (const name of names) {
  const { bin = {} } = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8"));
  const commands = typeof bin === "string" ? [name.split("/")[1]] : Object.keys(bin);
  for (const command of commands) {
    const link = `/usr/local/bin/${command}`;
    if (!existsSync(link)) symlinkSync(`/opt/osf/node_modules/.bin/${command}`, link);
  }
}
