// Shared setup of the sign-in scenarios (ADR 0134): an access file, the provider fakes.oidc and a console with
// CONSOLE_SIGN_IN. The session's key is a value of the test only.
import type { Fakes, Sut } from "@opensoftware/testkit";
import { factoryEnv, foreman } from "./console.ts";

export const SESSION_KEY = "testkit-session-key-1";

/** access.yaml in $INPUT with these people, ada@acme.dev as admin unless named. */
export const accessYaml = (people: Record<string, string> = { "ada@acme.dev": "admin" }) =>
  `version: 1\npeople:\n${Object.entries(people)
    .map(([email, role]) => `  - email: ${email}\n    role: ${role}\n`)
    .join("")}`;

/** Writes the factory and its access file, and gives the variables of a console that signs in at the provider. */
export async function signInEnv(
  sut: Sut,
  fakes: Fakes,
  people?: Record<string, string>,
): Promise<{ env: Record<string, string>; oidc: Awaited<ReturnType<Fakes["oidc"]>> }> {
  const oidc = await fakes.oidc();
  await sut.files.put("$INPUT/access.yaml", accessYaml(people));
  const api = await foreman(fakes, []);
  return {
    oidc,
    env: {
      CONSOLE_FOREMAN_URL: api.url,
      ...(await factoryEnv(sut)),
      CONSOLE_SIGN_IN: "oidc",
      CONSOLE_SESSION_SECRET: SESSION_KEY,
      CONSOLE_OIDC_ISSUER: oidc.url,
      CONSOLE_OIDC_CLIENT_ID: oidc.clientId,
      CONSOLE_OIDC_CLIENT_SECRET: oidc.clientSecret,
    },
  };
}

/** Opens "/" and signs in with the provider's button: the person of `oidc.signIn` lands on the page. */
export async function signedIn(sut: Sut) {
  const signIn = await sut.pages.open("/");
  return signIn.follow("Sign in");
}
