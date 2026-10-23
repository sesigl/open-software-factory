// @ts-nocheck
// The iron-proxy configuration of one sandbox (ADR 0054): the hosts it may reach, the secrets to swap and the MCP
// tools it may call. JSON is YAML, so iron-proxy reads it as written.
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
import { placeholder, type SecretFile } from "./spec.ts";

/** Where the proxy keeps its files: the config, its CA and the secrets, one file per variable. */
export const PROXY_DIR = stryMutAct_9fa48("428") ? "" : (stryCov_9fa48("428"), "/osf");

/** The proxy's start script: it creates the CA, hands its certificate out in `out/osf/`, then runs iron-proxy. */
export const START_SCRIPT = stryMutAct_9fa48("429") ? `` : (stryCov_9fa48("429"), `#!/bin/sh
set -e
mkdir -p ${PROXY_DIR}/out/osf
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=osf sandbox egress" \\
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign" \\
  -keyout ${PROXY_DIR}/ca.key -out ${PROXY_DIR}/ca.crt 2>/dev/null
cp ${PROXY_DIR}/ca.crt ${PROXY_DIR}/out/osf/egress-ca.crt
exec iron-proxy -config ${PROXY_DIR}/proxy.yaml
`);

/** The log line iron-proxy writes when the sandbox can use it. */
export const READY = stryMutAct_9fa48("430") ? "" : (stryCov_9fa48("430"), "tunnel proxy starting");
export function proxyConfig(spec: SandboxSpec, secrets: SecretFile[]): unknown {
  if (stryMutAct_9fa48("431")) {
    {}
  } else {
    stryCov_9fa48("431");
    const egress = stryMutAct_9fa48("432") ? spec.egress && [] : (stryCov_9fa48("432"), spec.egress ?? (stryMutAct_9fa48("433") ? ["Stryker was here"] : (stryCov_9fa48("433"), [])));
    const mcp = stryMutAct_9fa48("434") ? spec.mcp && [] : (stryCov_9fa48("434"), spec.mcp ?? (stryMutAct_9fa48("435") ? ["Stryker was here"] : (stryCov_9fa48("435"), [])));
    const hosts = stryMutAct_9fa48("436") ? [] : (stryCov_9fa48("436"), [...new Set(stryMutAct_9fa48("437") ? [] : (stryCov_9fa48("437"), [...egress, ...mcp.map(stryMutAct_9fa48("438") ? () => undefined : (stryCov_9fa48("438"), server => new URL(server.url).hostname))]))]);
    const swaps = secrets.map(stryMutAct_9fa48("439") ? () => undefined : (stryCov_9fa48("439"), ({
      variable
    }) => stryMutAct_9fa48("440") ? {} : (stryCov_9fa48("440"), {
      source: stryMutAct_9fa48("441") ? {} : (stryCov_9fa48("441"), {
        type: stryMutAct_9fa48("442") ? "" : (stryCov_9fa48("442"), "file"),
        path: stryMutAct_9fa48("443") ? `` : (stryCov_9fa48("443"), `${PROXY_DIR}/secrets/${variable}`)
      }),
      proxy_value: placeholder(variable),
      match_headers: stryMutAct_9fa48("444") ? ["Stryker was here"] : (stryCov_9fa48("444"), []),
      rules: egress.map(stryMutAct_9fa48("445") ? () => undefined : (stryCov_9fa48("445"), host => stryMutAct_9fa48("446") ? {} : (stryCov_9fa48("446"), {
        host
      })))
    })));
    return stryMutAct_9fa48("447") ? {} : (stryCov_9fa48("447"), {
      dns: stryMutAct_9fa48("448") ? {} : (stryCov_9fa48("448"), {
        listen: stryMutAct_9fa48("449") ? "" : (stryCov_9fa48("449"), "127.0.0.1:5353"),
        proxy_ip: stryMutAct_9fa48("450") ? "" : (stryCov_9fa48("450"), "127.0.0.1")
      }),
      proxy: stryMutAct_9fa48("451") ? {} : (stryCov_9fa48("451"), {
        http_listen: stryMutAct_9fa48("452") ? "" : (stryCov_9fa48("452"), ":8081"),
        https_listen: stryMutAct_9fa48("453") ? "" : (stryCov_9fa48("453"), ":8443"),
        tunnel_listen: stryMutAct_9fa48("454") ? "" : (stryCov_9fa48("454"), ":8080")
      }),
      tls: stryMutAct_9fa48("455") ? {} : (stryCov_9fa48("455"), {
        ca_cert: stryMutAct_9fa48("456") ? `` : (stryCov_9fa48("456"), `${PROXY_DIR}/ca.crt`),
        ca_key: stryMutAct_9fa48("457") ? `` : (stryCov_9fa48("457"), `${PROXY_DIR}/ca.key`)
      }),
      transforms: stryMutAct_9fa48("458") ? [] : (stryCov_9fa48("458"), [stryMutAct_9fa48("459") ? {} : (stryCov_9fa48("459"), {
        name: stryMutAct_9fa48("460") ? "" : (stryCov_9fa48("460"), "allowlist"),
        config: stryMutAct_9fa48("461") ? {} : (stryCov_9fa48("461"), {
          domains: hosts
        })
      }),
      // A secret is swapped only for the hosts of egress; without any, it goes nowhere.
      ...((stryMutAct_9fa48("464") ? egress.length || swaps.length : stryMutAct_9fa48("463") ? false : stryMutAct_9fa48("462") ? true : (stryCov_9fa48("462", "463", "464"), egress.length && swaps.length)) ? stryMutAct_9fa48("465") ? [] : (stryCov_9fa48("465"), [stryMutAct_9fa48("466") ? {} : (stryCov_9fa48("466"), {
        name: stryMutAct_9fa48("467") ? "" : (stryCov_9fa48("467"), "secrets"),
        config: stryMutAct_9fa48("468") ? {} : (stryCov_9fa48("468"), {
          secrets: swaps
        })
      })]) : stryMutAct_9fa48("469") ? ["Stryker was here"] : (stryCov_9fa48("469"), []))]),
      ...(mcp.length ? stryMutAct_9fa48("470") ? {} : (stryCov_9fa48("470"), {
        mcp: stryMutAct_9fa48("471") ? {} : (stryCov_9fa48("471"), {
          servers: mcp.map(server => {
            if (stryMutAct_9fa48("472")) {
              {}
            } else {
              stryCov_9fa48("472");
              const url = new URL(server.url);
              return stryMutAct_9fa48("473") ? {} : (stryCov_9fa48("473"), {
                name: server.name,
                rules: stryMutAct_9fa48("474") ? [] : (stryCov_9fa48("474"), [stryMutAct_9fa48("475") ? {} : (stryCov_9fa48("475"), {
                  host: url.hostname,
                  paths: stryMutAct_9fa48("476") ? [] : (stryCov_9fa48("476"), [url.pathname, stryMutAct_9fa48("477") ? `` : (stryCov_9fa48("477"), `${url.pathname.replace(stryMutAct_9fa48("478") ? /\// : (stryCov_9fa48("478"), /\/$/), stryMutAct_9fa48("479") ? "Stryker was here!" : (stryCov_9fa48("479"), ""))}/*`)])
                })]),
                tools: server.tools.map(stryMutAct_9fa48("480") ? () => undefined : (stryCov_9fa48("480"), name => stryMutAct_9fa48("481") ? {} : (stryCov_9fa48("481"), {
                  name
                })))
              });
            }
          })
        })
      }) : {}),
      log: stryMutAct_9fa48("482") ? {} : (stryCov_9fa48("482"), {
        level: stryMutAct_9fa48("483") ? "" : (stryCov_9fa48("483"), "info")
      })
    });
  }
}