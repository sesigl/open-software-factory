#!/usr/bin/env node
// @ts-nocheck
// sandbox-docker <command>: the entry layer only parses arguments and calls the commands (ADR 0054).
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { copy } from "./commands/copy.ts";
import { create } from "./commands/create.ts";
import { destroy } from "./commands/destroy.ts";
import { egressLog } from "./commands/egress-log.ts";
import { exec } from "./commands/exec.ts";
import { list } from "./commands/list.ts";
import { snapshot } from "./commands/snapshot.ts";
const USAGE = stryMutAct_9fa48("61") ? `` : (stryCov_9fa48("61"), `Usage: sandbox-docker <command>

Commands:
  create <spec.json>          Start a sandbox from a sandbox spec and print its ID.
  exec <ID> -- <command>...   Run the command in the sandbox's /workspace and exit with its code.
  copy <from> <to>            Copy a file or folder into or out of a sandbox; the sandbox's side is <ID>:<path>.
  snapshot <ID>               Save the sandbox's files and print a template that create accepts.
  destroy <ID>                Remove the sandbox and all its data.
  list                        Print the IDs of the sandboxes.
  egress-log <ID>             Print one JSON line per request that left the sandbox.
`);
const {
  positionals,
  values
} = parseArgs(stryMutAct_9fa48("62") ? {} : (stryCov_9fa48("62"), {
  allowPositionals: stryMutAct_9fa48("63") ? false : (stryCov_9fa48("63"), true),
  options: stryMutAct_9fa48("64") ? {} : (stryCov_9fa48("64"), {
    help: stryMutAct_9fa48("65") ? {} : (stryCov_9fa48("65"), {
      type: stryMutAct_9fa48("66") ? "" : (stryCov_9fa48("66"), "boolean")
    })
  })
}));
const [name, first, second, ...rest] = positionals;
const secretsDir = stryMutAct_9fa48("67") ? process.env.OSF_SECRETS_DIR && "/run/secrets" : (stryCov_9fa48("67"), process.env.OSF_SECRETS_DIR ?? (stryMutAct_9fa48("68") ? "" : (stryCov_9fa48("68"), "/run/secrets")));
const commands: Record<string, Command> = stryMutAct_9fa48("69") ? {} : (stryCov_9fa48("69"), {
  create: stryMutAct_9fa48("70") ? () => undefined : (stryCov_9fa48("70"), () => create(first, secretsDir)),
  exec: stryMutAct_9fa48("71") ? () => undefined : (stryCov_9fa48("71"), () => exec(first, stryMutAct_9fa48("72") ? [second, ...rest] : (stryCov_9fa48("72"), (stryMutAct_9fa48("73") ? [] : (stryCov_9fa48("73"), [second, ...rest])).filter(stryMutAct_9fa48("74") ? () => undefined : (stryCov_9fa48("74"), part => stryMutAct_9fa48("77") ? part === undefined : stryMutAct_9fa48("76") ? false : stryMutAct_9fa48("75") ? true : (stryCov_9fa48("75", "76", "77"), part !== undefined)))))),
  copy: stryMutAct_9fa48("78") ? () => undefined : (stryCov_9fa48("78"), () => copy(first, second)),
  snapshot: stryMutAct_9fa48("79") ? () => undefined : (stryCov_9fa48("79"), () => snapshot(first)),
  destroy: stryMutAct_9fa48("80") ? () => undefined : (stryCov_9fa48("80"), () => destroy(first)),
  list: stryMutAct_9fa48("81") ? () => undefined : (stryCov_9fa48("81"), () => list()),
  "egress-log": stryMutAct_9fa48("82") ? () => undefined : (stryCov_9fa48("82"), () => egressLog(first))
});
process.exitCode = await runProgram(stryMutAct_9fa48("83") ? {} : (stryCov_9fa48("83"), {
  name: stryMutAct_9fa48("84") ? "" : (stryCov_9fa48("84"), "sandbox-docker"),
  usage: USAGE,
  command: (stryMutAct_9fa48("87") ? name !== undefined : stryMutAct_9fa48("86") ? false : stryMutAct_9fa48("85") ? true : (stryCov_9fa48("85", "86", "87"), name === undefined)) ? undefined : commands[name],
  help: values.help
}));