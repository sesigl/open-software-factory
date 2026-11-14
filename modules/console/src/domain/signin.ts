// The console's own sign-in (ADR 0134): which settings it needs, which address it may run on, and which paths a person
// may come back to. Without I/O.

export type Provider = "oidc" | "github";

export interface SignIn {
  provider: Provider;
  /** The console's own address, like "http://localhost:8080", without a trailing slash. */
  url: string;
  /** The keys of the session: the first signs, every one is accepted. */
  keys: string[];
  /** How long a session lasts, in seconds. */
  seconds: number;
  oidc?: { issuer: string; clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string; url: string; apiUrl: string };
}

type Env = Record<string, string | undefined>;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The sign-in that the settings switch on, `undefined` when CONSOLE_SIGN_IN is not set, or the problems that stop the
 * console from starting: each names the setting to fix.
 */
export function signInOf(env: Env): SignIn | undefined | string[] {
  const provider = env.CONSOLE_SIGN_IN;
  if (!provider) return undefined;
  const problems: string[] = [];
  const need = (name: string): string => {
    const value = env[name];
    if (!value) problems.push(`set ${name}: CONSOLE_SIGN_IN=${provider} needs it`);
    return value ?? "";
  };
  if (provider !== "oidc" && provider !== "github") return [`CONSOLE_SIGN_IN must be oidc or github, not ${provider}`];
  if (env.CONSOLE_USER_HEADER)
    problems.push("set either CONSOLE_SIGN_IN or CONSOLE_USER_HEADER: the console signs people in, or a proxy does");
  const url = (env.CONSOLE_URL || `http://localhost:${env.PORT || 8080}`).replace(/\/$/, "");
  const address = URL.canParse(url) ? new URL(url) : undefined;
  if (!address || (address.protocol !== "https:" && !LOOPBACK.has(address.hostname)))
    problems.push(
      `CONSOLE_URL ${url} is neither https:// nor loopback: the session cookie would cross the network in clear text`,
    );
  const keys = need("CONSOLE_SESSION_SECRET")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const hours = Number(env.CONSOLE_SESSION_HOURS || 12);
  const sign: SignIn = { provider, url, keys, seconds: hours * 3600 };
  if (provider === "oidc") {
    sign.oidc = {
      issuer: need("CONSOLE_OIDC_ISSUER"),
      clientId: need("CONSOLE_OIDC_CLIENT_ID"),
      clientSecret: need("CONSOLE_OIDC_CLIENT_SECRET"),
    };
  } else {
    sign.github = {
      clientId: need("CONSOLE_GITHUB_CLIENT_ID"),
      clientSecret: need("CONSOLE_GITHUB_CLIENT_SECRET"),
      url: (env.CONSOLE_GITHUB_URL || "https://github.com").replace(/\/$/, ""),
      apiUrl: (env.CONSOLE_GITHUB_API_URL || "https://api.github.com").replace(/\/$/, ""),
    };
  }
  return problems.length ? problems : sign;
}

/** The path a person comes back to after the sign-in: only a path of the console, else "/". */
export function safeNext(next: string | undefined): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
