// @ts-nocheck
// create <spec.json>: the sandbox's container on an internal network, and its iron-proxy as the only way out.
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
import { join } from "node:path";
import { check, type Outcome, UsageError } from "@opensoftware/cli";
import { type SandboxSpec, validate } from "@opensoftware/contracts";
import { docker, dockerText } from "../adapters/docker.ts";
import { fileExists, readText, withFolder } from "../adapters/files.ts";
import { EGRESS_IMAGE, egressName, ROLE_LABEL, sandboxName, WORKSPACE } from "../domain/names.ts";
import { PROXY_DIR, proxyConfig, READY, START_SCRIPT } from "../domain/proxy-config.ts";
import { memoryBytes, type SecretFile, sandboxEnv, secretFiles } from "../domain/spec.ts";
import { destroySandbox } from "./destroy.ts";
const READY_TIMEOUT_MS = 20_000;
export async function create(file: string | undefined, secretsDir: string): Promise<Outcome> {
  if (stryMutAct_9fa48("128")) {
    {}
  } else {
    stryCov_9fa48("128");
    check(file, stryMutAct_9fa48("130") ? "" : (stryCov_9fa48("130"), "name the sandbox spec, like create spec.json"));
    const spec = readSpec(file as string);
    const secrets = resolveSecrets(spec, secretsDir);
    const container = await dockerText(stryMutAct_9fa48("131") ? [] : (stryCov_9fa48("131"), [stryMutAct_9fa48("132") ? "" : (stryCov_9fa48("132"), "create"), ...sandboxArgs(spec), spec.template, stryMutAct_9fa48("133") ? "" : (stryCov_9fa48("133"), "infinity")]));
    const id = stryMutAct_9fa48("134") ? container : (stryCov_9fa48("134"), container.slice(0, 12));
    try {
      if (stryMutAct_9fa48("135")) {
        {}
      } else {
        stryCov_9fa48("135");
        await dockerText(stryMutAct_9fa48("136") ? [] : (stryCov_9fa48("136"), [stryMutAct_9fa48("137") ? "" : (stryCov_9fa48("137"), "rename"), container, sandboxName(id)]));
        await dockerText(stryMutAct_9fa48("138") ? [] : (stryCov_9fa48("138"), [stryMutAct_9fa48("139") ? "" : (stryCov_9fa48("139"), "network"), stryMutAct_9fa48("140") ? "" : (stryCov_9fa48("140"), "create"), stryMutAct_9fa48("141") ? "" : (stryCov_9fa48("141"), "--internal"), stryMutAct_9fa48("142") ? "" : (stryCov_9fa48("142"), "--label"), stryMutAct_9fa48("143") ? `` : (stryCov_9fa48("143"), `osf.sandbox.id=${id}`), sandboxName(id)]));
        await startEgress(id, spec, secrets, secretsDir);
        await startSandbox(id);
      }
    } catch (error) {
      if (stryMutAct_9fa48("144")) {
        {}
      } else {
        stryCov_9fa48("144");
        await destroySandbox(id);
        if (stryMutAct_9fa48("145")) {
          ;
        } else {
          stryCov_9fa48("145");
          throw new Error(stryMutAct_9fa48("146") ? `` : (stryCov_9fa48("146"), `the sandbox ${id} did not start and was removed: ${(error as Error).message}`));
        }
      }
    }
    return stryMutAct_9fa48("147") ? {} : (stryCov_9fa48("147"), {
      lines: stryMutAct_9fa48("148") ? [] : (stryCov_9fa48("148"), [id])
    });
  }
}
function readSpec(file: string): SandboxSpec {
  if (stryMutAct_9fa48("149")) {
    {}
  } else {
    stryCov_9fa48("149");
    const document: unknown = JSON.parse(readText(file));
    const problems = validate(stryMutAct_9fa48("150") ? "" : (stryCov_9fa48("150"), "sandbox-spec"), document);
    if (stryMutAct_9fa48("152") ? false : stryMutAct_9fa48("151") ? true : (stryCov_9fa48("151", "152"), problems.length)) {
      if (stryMutAct_9fa48("153")) {
        {}
      } else {
        stryCov_9fa48("153");
        throw new UsageError(problems.map(stryMutAct_9fa48("155") ? () => undefined : (stryCov_9fa48("155"), problem => stryMutAct_9fa48("156") ? `` : (stryCov_9fa48("156"), `${file}: ${problem.path} ${problem.message}`))).join(stryMutAct_9fa48("157") ? "" : (stryCov_9fa48("157"), "\n")));
      }
    }
    return document as SandboxSpec;
  }
}
function resolveSecrets(spec: SandboxSpec, secretsDir: string): SecretFile[] {
  if (stryMutAct_9fa48("158")) {
    {}
  } else {
    stryCov_9fa48("158");
    const {
      files,
      problems
    } = secretFiles(spec);
    for (const {
      variable,
      file
    } of files) {
      if (stryMutAct_9fa48("159")) {
        {}
      } else {
        stryCov_9fa48("159");
        if (stryMutAct_9fa48("162") ? false : stryMutAct_9fa48("161") ? true : stryMutAct_9fa48("160") ? fileExists(join(secretsDir, file)) : (stryCov_9fa48("160", "161", "162"), !fileExists(join(secretsDir, file)))) problems.push(stryMutAct_9fa48("164") ? `` : (stryCov_9fa48("164"), `secret "${variable}" has no file "${file}" in ${secretsDir}`));
      }
    }
    if (stryMutAct_9fa48("166") ? false : stryMutAct_9fa48("165") ? true : (stryCov_9fa48("165", "166"), problems.length)) throw new UsageError(problems.join(stryMutAct_9fa48("168") ? "" : (stryCov_9fa48("168"), "\n")));
    return files;
  }
}

/** The sandbox's container: no network until its egress proxy runs, the spec's limits and its environment. */
function sandboxArgs(spec: SandboxSpec): string[] {
  if (stryMutAct_9fa48("169")) {
    {}
  } else {
    stryCov_9fa48("169");
    const env = Object.entries(sandboxEnv(spec)).flatMap(stryMutAct_9fa48("170") ? () => undefined : (stryCov_9fa48("170"), ([name, value]) => stryMutAct_9fa48("171") ? [] : (stryCov_9fa48("171"), [stryMutAct_9fa48("172") ? "" : (stryCov_9fa48("172"), "--env"), stryMutAct_9fa48("173") ? `` : (stryCov_9fa48("173"), `${name}=${value}`)])));
    return stryMutAct_9fa48("174") ? [] : (stryCov_9fa48("174"), [stryMutAct_9fa48("175") ? "" : (stryCov_9fa48("175"), "--network"), stryMutAct_9fa48("176") ? "" : (stryCov_9fa48("176"), "none"), stryMutAct_9fa48("177") ? "" : (stryCov_9fa48("177"), "--label"), ROLE_LABEL, ...(spec.cpu ? stryMutAct_9fa48("178") ? [] : (stryCov_9fa48("178"), [stryMutAct_9fa48("179") ? "" : (stryCov_9fa48("179"), "--cpus"), String(spec.cpu)]) : stryMutAct_9fa48("180") ? ["Stryker was here"] : (stryCov_9fa48("180"), [])), ...(spec.memory ? stryMutAct_9fa48("181") ? [] : (stryCov_9fa48("181"), [stryMutAct_9fa48("182") ? "" : (stryCov_9fa48("182"), "--memory"), String(memoryBytes(spec.memory))]) : stryMutAct_9fa48("183") ? ["Stryker was here"] : (stryCov_9fa48("183"), [])), stryMutAct_9fa48("184") ? "" : (stryCov_9fa48("184"), "--security-opt"), stryMutAct_9fa48("185") ? "" : (stryCov_9fa48("185"), "no-new-privileges"), stryMutAct_9fa48("186") ? "" : (stryCov_9fa48("186"), "--workdir"), WORKSPACE, stryMutAct_9fa48("187") ? "" : (stryCov_9fa48("187"), "--entrypoint"), stryMutAct_9fa48("188") ? "" : (stryCov_9fa48("188"), "sleep"), ...env]);
  }
}

/** The proxy joins the default bridge for the way out and the sandbox's network as "egress". */
async function startEgress(id: string, spec: SandboxSpec, secrets: SecretFile[], secretsDir: string): Promise<void> {
  if (stryMutAct_9fa48("189")) {
    {}
  } else {
    stryCov_9fa48("189");
    const proxy = egressName(id);
    await dockerText(stryMutAct_9fa48("190") ? [] : (stryCov_9fa48("190"), [stryMutAct_9fa48("191") ? "" : (stryCov_9fa48("191"), "create"), stryMutAct_9fa48("192") ? "" : (stryCov_9fa48("192"), "--name"), proxy, stryMutAct_9fa48("193") ? "" : (stryCov_9fa48("193"), "--label"), stryMutAct_9fa48("194") ? `` : (stryCov_9fa48("194"), `osf.sandbox.id=${id}`), stryMutAct_9fa48("195") ? "" : (stryCov_9fa48("195"), "--add-host"), stryMutAct_9fa48("196") ? "" : (stryCov_9fa48("196"), "host.docker.internal:host-gateway"), stryMutAct_9fa48("197") ? "" : (stryCov_9fa48("197"), "--entrypoint"), stryMutAct_9fa48("198") ? "" : (stryCov_9fa48("198"), "sh"), EGRESS_IMAGE, stryMutAct_9fa48("199") ? `` : (stryCov_9fa48("199"), `${PROXY_DIR}/start.sh`)]));
    const files = stryMutAct_9fa48("200") ? {} : (stryCov_9fa48("200"), {
      "proxy.yaml": stryMutAct_9fa48("201") ? `` : (stryCov_9fa48("201"), `${JSON.stringify(proxyConfig(spec, secrets), null, 2)}\n`),
      "start.sh": START_SCRIPT,
      "secrets/.keep": stryMutAct_9fa48("202") ? "Stryker was here!" : (stryCov_9fa48("202"), "")
    });
    await withFolder(files, stryMutAct_9fa48("203") ? () => undefined : (stryCov_9fa48("203"), folder => dockerText(stryMutAct_9fa48("204") ? [] : (stryCov_9fa48("204"), [stryMutAct_9fa48("205") ? "" : (stryCov_9fa48("205"), "cp"), stryMutAct_9fa48("206") ? `` : (stryCov_9fa48("206"), `${folder}/.`), stryMutAct_9fa48("207") ? `` : (stryCov_9fa48("207"), `${proxy}:${PROXY_DIR}`)]))));
    // The Docker CLI copies each secret's file; the adapter never reads it.
    for (const {
      variable,
      file
    } of secrets) {
      if (stryMutAct_9fa48("208")) {
        {}
      } else {
        stryCov_9fa48("208");
        await dockerText(stryMutAct_9fa48("209") ? [] : (stryCov_9fa48("209"), [stryMutAct_9fa48("210") ? "" : (stryCov_9fa48("210"), "cp"), stryMutAct_9fa48("211") ? "" : (stryCov_9fa48("211"), "-L"), join(secretsDir, file), stryMutAct_9fa48("212") ? `` : (stryCov_9fa48("212"), `${proxy}:${PROXY_DIR}/secrets/${variable}`)]));
      }
    }
    await dockerText(stryMutAct_9fa48("213") ? [] : (stryCov_9fa48("213"), [stryMutAct_9fa48("214") ? "" : (stryCov_9fa48("214"), "network"), stryMutAct_9fa48("215") ? "" : (stryCov_9fa48("215"), "connect"), stryMutAct_9fa48("216") ? "" : (stryCov_9fa48("216"), "--alias"), stryMutAct_9fa48("217") ? "" : (stryCov_9fa48("217"), "egress"), sandboxName(id), proxy]));
    await dockerText(stryMutAct_9fa48("218") ? [] : (stryCov_9fa48("218"), [stryMutAct_9fa48("219") ? "" : (stryCov_9fa48("219"), "start"), proxy]));
    await waitUntilReady(proxy);
  }
}
async function waitUntilReady(proxy: string): Promise<void> {
  if (stryMutAct_9fa48("220")) {
    {}
  } else {
    stryCov_9fa48("220");
    const deadline = stryMutAct_9fa48("221") ? Date.now() - READY_TIMEOUT_MS : (stryCov_9fa48("221"), Date.now() + READY_TIMEOUT_MS);
    if (stryMutAct_9fa48("222")) {
      for (; false;) {
        const logs = await docker(["logs", proxy]);
        const text = logs.stdout.toString("utf8") + logs.stderr;
        if (text.includes(READY)) return;
        const state = await dockerText(["container", "inspect", "--format", "{{.State.Status}}", proxy]);
        if (state !== "running" || Date.now() > deadline) throw new Error(`the egress proxy did not start: ${text.trim()}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      stryCov_9fa48("222");
      for (;;) {
        if (stryMutAct_9fa48("223")) {
          {}
        } else {
          stryCov_9fa48("223");
          const logs = await docker(stryMutAct_9fa48("224") ? [] : (stryCov_9fa48("224"), [stryMutAct_9fa48("225") ? "" : (stryCov_9fa48("225"), "logs"), proxy]));
          const text = stryMutAct_9fa48("226") ? logs.stdout.toString("utf8") - logs.stderr : (stryCov_9fa48("226"), logs.stdout.toString(stryMutAct_9fa48("227") ? "" : (stryCov_9fa48("227"), "utf8")) + logs.stderr);
          if (stryMutAct_9fa48("229") ? false : stryMutAct_9fa48("228") ? true : (stryCov_9fa48("228", "229"), text.includes(READY))) return;
          const state = await dockerText(stryMutAct_9fa48("230") ? [] : (stryCov_9fa48("230"), [stryMutAct_9fa48("231") ? "" : (stryCov_9fa48("231"), "container"), stryMutAct_9fa48("232") ? "" : (stryCov_9fa48("232"), "inspect"), stryMutAct_9fa48("233") ? "" : (stryCov_9fa48("233"), "--format"), stryMutAct_9fa48("234") ? "" : (stryCov_9fa48("234"), "{{.State.Status}}"), proxy]));
          if (stryMutAct_9fa48("237") ? state !== "running" && Date.now() > deadline : stryMutAct_9fa48("236") ? false : stryMutAct_9fa48("235") ? true : (stryCov_9fa48("235", "236", "237"), (stryMutAct_9fa48("239") ? state === "running" : stryMutAct_9fa48("238") ? false : (stryCov_9fa48("238", "239"), state !== (stryMutAct_9fa48("240") ? "" : (stryCov_9fa48("240"), "running")))) || (stryMutAct_9fa48("243") ? Date.now() <= deadline : stryMutAct_9fa48("242") ? Date.now() >= deadline : stryMutAct_9fa48("241") ? false : (stryCov_9fa48("241", "242", "243"), Date.now() > deadline)))) throw new Error(stryMutAct_9fa48("245") ? `` : (stryCov_9fa48("245"), `the egress proxy did not start: ${stryMutAct_9fa48("246") ? text : (stryCov_9fa48("246"), text.trim())}`));
          await new Promise(stryMutAct_9fa48("247") ? () => undefined : (stryCov_9fa48("247"), resolve => setTimeout(resolve, 100)));
        }
      }
    }
  }
}

/** The sandbox trusts the proxy's CA, moves to its network, starts, and owns its working folder. */
async function startSandbox(id: string): Promise<void> {
  if (stryMutAct_9fa48("248")) {
    {}
  } else {
    stryCov_9fa48("248");
    const container = sandboxName(id);
    const ca = await docker(stryMutAct_9fa48("249") ? [] : (stryCov_9fa48("249"), [stryMutAct_9fa48("250") ? "" : (stryCov_9fa48("250"), "cp"), stryMutAct_9fa48("251") ? `` : (stryCov_9fa48("251"), `${egressName(id)}:${PROXY_DIR}/out/osf`), stryMutAct_9fa48("252") ? "" : (stryCov_9fa48("252"), "-")]));
    if (stryMutAct_9fa48("255") ? ca.code === 0 : stryMutAct_9fa48("254") ? false : stryMutAct_9fa48("253") ? true : (stryCov_9fa48("253", "254", "255"), ca.code !== 0)) throw new Error(stryMutAct_9fa48("257") ? `` : (stryCov_9fa48("257"), `the egress proxy has no CA: ${stryMutAct_9fa48("258") ? ca.stderr : (stryCov_9fa48("258"), ca.stderr.trim())}`));
    await dockerText(stryMutAct_9fa48("259") ? [] : (stryCov_9fa48("259"), [stryMutAct_9fa48("260") ? "" : (stryCov_9fa48("260"), "cp"), stryMutAct_9fa48("261") ? "" : (stryCov_9fa48("261"), "-"), stryMutAct_9fa48("262") ? `` : (stryCov_9fa48("262"), `${container}:/etc`)]), ca.stdout);
    await dockerText(stryMutAct_9fa48("263") ? [] : (stryCov_9fa48("263"), [stryMutAct_9fa48("264") ? "" : (stryCov_9fa48("264"), "network"), stryMutAct_9fa48("265") ? "" : (stryCov_9fa48("265"), "disconnect"), stryMutAct_9fa48("266") ? "" : (stryCov_9fa48("266"), "none"), container]));
    await dockerText(stryMutAct_9fa48("267") ? [] : (stryCov_9fa48("267"), [stryMutAct_9fa48("268") ? "" : (stryCov_9fa48("268"), "network"), stryMutAct_9fa48("269") ? "" : (stryCov_9fa48("269"), "connect"), container, container]));
    await dockerText(stryMutAct_9fa48("270") ? [] : (stryCov_9fa48("270"), [stryMutAct_9fa48("271") ? "" : (stryCov_9fa48("271"), "start"), container]));
    const owner = stryMutAct_9fa48("272") ? `` : (stryCov_9fa48("272"), `${await dockerText(stryMutAct_9fa48("273") ? [] : (stryCov_9fa48("273"), [stryMutAct_9fa48("274") ? "" : (stryCov_9fa48("274"), "exec"), container, stryMutAct_9fa48("275") ? "" : (stryCov_9fa48("275"), "id"), stryMutAct_9fa48("276") ? "" : (stryCov_9fa48("276"), "-u")]))}:${await dockerText(stryMutAct_9fa48("277") ? [] : (stryCov_9fa48("277"), [stryMutAct_9fa48("278") ? "" : (stryCov_9fa48("278"), "exec"), container, stryMutAct_9fa48("279") ? "" : (stryCov_9fa48("279"), "id"), stryMutAct_9fa48("280") ? "" : (stryCov_9fa48("280"), "-g")]))}`);
    await dockerText(stryMutAct_9fa48("281") ? [] : (stryCov_9fa48("281"), [stryMutAct_9fa48("282") ? "" : (stryCov_9fa48("282"), "exec"), stryMutAct_9fa48("283") ? "" : (stryCov_9fa48("283"), "--user"), stryMutAct_9fa48("284") ? "" : (stryCov_9fa48("284"), "0"), container, stryMutAct_9fa48("285") ? "" : (stryCov_9fa48("285"), "chown"), owner, WORKSPACE]));
  }
}