// @ts-nocheck
// The sandbox spec as the docker adapter applies it: memory in bytes, the secrets' files and the sandbox's
// environment, which holds placeholders and never a real secret.
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
import type { SandboxSpec } from "@opensoftware/contracts";
import { CA_FILE, EGRESS_URL } from "./names.ts";
const UNITS: Record<string, number> = stryMutAct_9fa48("484") ? {} : (stryCov_9fa48("484"), {
  "": 1,
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4
});

/** A Kubernetes quantity such as "256Mi" in bytes, as `docker create --memory` takes it. */
export function memoryBytes(quantity: string): number {
  if (stryMutAct_9fa48("485")) {
    {}
  } else {
    stryCov_9fa48("485");
    const [, amount, unit] = stryMutAct_9fa48("486") ? /^([0-9]+)(Ki|Mi|Gi|Ti)?$/.exec(quantity) && [] : (stryCov_9fa48("486"), (stryMutAct_9fa48("491") ? /^([0-9]+)(Ki|Mi|Gi|Ti)$/ : stryMutAct_9fa48("490") ? /^([^0-9]+)(Ki|Mi|Gi|Ti)?$/ : stryMutAct_9fa48("489") ? /^([0-9])(Ki|Mi|Gi|Ti)?$/ : stryMutAct_9fa48("488") ? /^([0-9]+)(Ki|Mi|Gi|Ti)?/ : stryMutAct_9fa48("487") ? /([0-9]+)(Ki|Mi|Gi|Ti)?$/ : (stryCov_9fa48("487", "488", "489", "490", "491"), /^([0-9]+)(Ki|Mi|Gi|Ti)?$/)).exec(quantity) ?? (stryMutAct_9fa48("492") ? ["Stryker was here"] : (stryCov_9fa48("492"), [])));
    return stryMutAct_9fa48("493") ? Number(amount) / (UNITS[unit ?? ""] as number) : (stryCov_9fa48("493"), Number(amount) * (UNITS[unit ?? ""] as number));
  }
}

/** A secret of the spec: the variable in the sandbox and the file in OSF_SECRETS_DIR that holds the real value. */
export interface SecretFile {
  variable: string;
  file: string;
}

/**
 * The secrets of the spec as files, or the reason why one cannot be resolved. The docker adapter resolves only the
 * provider `file`: `ref:file/<name>` is `<name>` in OSF_SECRETS_DIR.
 */
export function secretFiles(spec: SandboxSpec): {
  files: SecretFile[];
  problems: string[];
} {
  if (stryMutAct_9fa48("494")) {
    {}
  } else {
    stryCov_9fa48("494");
    const files: SecretFile[] = stryMutAct_9fa48("495") ? ["Stryker was here"] : (stryCov_9fa48("495"), []);
    const problems: string[] = stryMutAct_9fa48("496") ? ["Stryker was here"] : (stryCov_9fa48("496"), []);
    for (const [variable, reference] of Object.entries(stryMutAct_9fa48("497") ? spec.secrets && {} : (stryCov_9fa48("497"), spec.secrets ?? {}))) {
      if (stryMutAct_9fa48("498")) {
        {}
      } else {
        stryCov_9fa48("498");
        const [, provider, name] = stryMutAct_9fa48("499") ? /^ref:([^/]+)\/(.+)$/.exec(reference) && [] : (stryCov_9fa48("499"), (stryMutAct_9fa48("504") ? /^ref:([^/]+)\/(.)$/ : stryMutAct_9fa48("503") ? /^ref:([/]+)\/(.+)$/ : stryMutAct_9fa48("502") ? /^ref:([^/])\/(.+)$/ : stryMutAct_9fa48("501") ? /^ref:([^/]+)\/(.+)/ : stryMutAct_9fa48("500") ? /ref:([^/]+)\/(.+)$/ : (stryCov_9fa48("500", "501", "502", "503", "504"), /^ref:([^/]+)\/(.+)$/)).exec(reference) ?? (stryMutAct_9fa48("505") ? ["Stryker was here"] : (stryCov_9fa48("505"), [])));
        if (stryMutAct_9fa48("508") ? provider === "file" : stryMutAct_9fa48("507") ? false : stryMutAct_9fa48("506") ? true : (stryCov_9fa48("506", "507", "508"), provider !== (stryMutAct_9fa48("509") ? "" : (stryCov_9fa48("509"), "file")))) {
          if (stryMutAct_9fa48("510")) {
            {}
          } else {
            stryCov_9fa48("510");
            problems.push(stryMutAct_9fa48("512") ? `` : (stryCov_9fa48("512"), `secret "${variable}": the provider "${provider}" is not supported; sandbox-docker supports "file"`));
          }
        } else if (stryMutAct_9fa48("515") ? name.split("/").includes("..") : stryMutAct_9fa48("514") ? false : stryMutAct_9fa48("513") ? true : (stryCov_9fa48("513", "514", "515"), name?.split(stryMutAct_9fa48("516") ? "" : (stryCov_9fa48("516"), "/")).includes(stryMutAct_9fa48("517") ? "" : (stryCov_9fa48("517"), "..")))) {
          if (stryMutAct_9fa48("518")) {
            {}
          } else {
            stryCov_9fa48("518");
            problems.push(stryMutAct_9fa48("520") ? `` : (stryCov_9fa48("520"), `secret "${variable}": the name "${name}" leaves OSF_SECRETS_DIR`));
          }
        } else {
          if (stryMutAct_9fa48("521")) {
            {}
          } else {
            stryCov_9fa48("521");
            if (stryMutAct_9fa48("522")) {
              ;
            } else {
              stryCov_9fa48("522");
              files.push(stryMutAct_9fa48("523") ? {} : (stryCov_9fa48("523"), {
                variable,
                file: name as string
              }));
            }
          }
        }
      }
    }
    return stryMutAct_9fa48("524") ? {} : (stryCov_9fa48("524"), {
      files,
      problems
    });
  }
}

/** The value the sandbox holds in place of a secret; the egress proxy swaps it for the real one. */
export const placeholder = stryMutAct_9fa48("525") ? () => undefined : (stryCov_9fa48("525"), (() => {
  const placeholder = (variable: string): string => stryMutAct_9fa48("526") ? `` : (stryCov_9fa48("526"), `osf-secret-placeholder-${variable}`);
  return placeholder;
})());

/** The sandbox's environment: the spec's variables, a placeholder per secret, the egress proxy and its CA. */
export function sandboxEnv(spec: SandboxSpec): Record<string, string> {
  if (stryMutAct_9fa48("527")) {
    {}
  } else {
    stryCov_9fa48("527");
    const secrets = Object.keys(stryMutAct_9fa48("528") ? spec.secrets && {} : (stryCov_9fa48("528"), spec.secrets ?? {})).map(stryMutAct_9fa48("529") ? () => undefined : (stryCov_9fa48("529"), variable => stryMutAct_9fa48("530") ? [] : (stryCov_9fa48("530"), [variable, placeholder(variable)])));
    const proxy = (stryMutAct_9fa48("531") ? [] : (stryCov_9fa48("531"), [stryMutAct_9fa48("532") ? "" : (stryCov_9fa48("532"), "HTTP_PROXY"), stryMutAct_9fa48("533") ? "" : (stryCov_9fa48("533"), "HTTPS_PROXY"), stryMutAct_9fa48("534") ? "" : (stryCov_9fa48("534"), "http_proxy"), stryMutAct_9fa48("535") ? "" : (stryCov_9fa48("535"), "https_proxy")])).map(stryMutAct_9fa48("536") ? () => undefined : (stryCov_9fa48("536"), name => stryMutAct_9fa48("537") ? [] : (stryCov_9fa48("537"), [name, EGRESS_URL])));
    const ca = (stryMutAct_9fa48("538") ? [] : (stryCov_9fa48("538"), [stryMutAct_9fa48("539") ? "" : (stryCov_9fa48("539"), "SSL_CERT_FILE"), stryMutAct_9fa48("540") ? "" : (stryCov_9fa48("540"), "NODE_EXTRA_CA_CERTS"), stryMutAct_9fa48("541") ? "" : (stryCov_9fa48("541"), "REQUESTS_CA_BUNDLE"), stryMutAct_9fa48("542") ? "" : (stryCov_9fa48("542"), "CURL_CA_BUNDLE"), stryMutAct_9fa48("543") ? "" : (stryCov_9fa48("543"), "GIT_SSL_CAINFO")])).map(stryMutAct_9fa48("544") ? () => undefined : (stryCov_9fa48("544"), name => stryMutAct_9fa48("545") ? [] : (stryCov_9fa48("545"), [name, CA_FILE])));
    return stryMutAct_9fa48("546") ? {} : (stryCov_9fa48("546"), {
      ...spec.env,
      ...Object.fromEntries(stryMutAct_9fa48("547") ? [] : (stryCov_9fa48("547"), [...secrets, ...proxy, ...ca]))
    });
  }
}