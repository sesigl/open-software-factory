#!/usr/bin/env node
// `node tools/bin/bundle.ts <package>`: the build script of a bundled package (ADR 0079), the same as `osf bundle`.
// It loads only the bundler: a publish job builds one package and its dependencies, so the other commands of osf,
// which need other built packages of the repository, would fail there.
import { spawnSync } from "node:child_process";
import { bundle } from "../scaffold/bundle.ts";

const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
process.exitCode = await bundle(git.status === 0 ? git.stdout.trim() : process.cwd(), process.argv.slice(2));
