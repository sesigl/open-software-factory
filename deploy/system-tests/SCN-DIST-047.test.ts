import { scenario } from "@opensoftware/testkit";
import { cluster, rendered, values } from "./chart.ts";

/** The console's sign-in with GitHub, made up for the test: no GitHub issued the app. */
const SIGN_IN = [
  "console:",
  "  signIn:",
  "    provider: github",
  "    clientId: Iv1.acme0console",
  "    secret: osf-sign-in",
  "",
];
const KEYS = "console=http://osf-console:8080/.well-known/jwks.json";

/** An environment variable of a container that names its value, as "helm template" renders it. */
const value = (name: string, text: string) => new RegExp(`- name: ${name}\\n\\s+value: "${text}"\\n`);

scenario("SCN-DIST-047", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given(
    'a values file that sets every value under "secrets", and under "console.signIn" the provider "github", its client ID and the Secret "osf-sign-in"',
    async () => {
      await values(sut, [], {}, SIGN_IN.join("\n"));
    },
  );

  let result: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs "helm template osf deploy/helm/osf --values values.yaml"', async () => {
    result = await helm.run(["template", "osf", helm.chart, "--values", "values.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(result.exitCode, result.stderr).toBe(0);
  });

  await then(
    'the deployment "console" sets "CONSOLE_SIGNING_KEY" from the key "signing-key" of the Secret "osf-sign-in"',
    async () => {
      expect(rendered(result.stdout, "console.yaml")).toMatch(
        /- name: CONSOLE_SIGNING_KEY\n\s+valueFrom:\n\s+secretKeyRef:\n\s+name: osf-sign-in\n\s+key: signing-key\n/,
      );
    },
  );

  await then(
    'the deployments "foreman", "intake" and "gatekeeper" set "FOREMAN_PERSON_KEYS", "INTAKE_PERSON_KEYS" and "GATEKEEPER_PERSON_KEYS" to "console=http://osf-console:8080/.well-known/jwks.json"',
    async () => {
      expect(rendered(result.stdout, "foreman.yaml")).toMatch(value("FOREMAN_PERSON_KEYS", KEYS));
      expect(rendered(result.stdout, "intake.yaml")).toMatch(value("INTAKE_PERSON_KEYS", KEYS));
      expect(rendered(result.stdout, "gatekeeper.yaml")).toMatch(value("GATEKEEPER_PERSON_KEYS", KEYS));
    },
  );

  let without: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs it again with a values file without "console.signIn"', async () => {
    await values(sut);
    without = await helm.run(["template", "osf", helm.chart, "--values", "values.yaml"]);
  });

  await then('no deployment sets "CONSOLE_SIGNING_KEY" or a setting "_PERSON_KEYS"', async () => {
    expect(without.exitCode, without.stderr).toBe(0);
    expect(without.stdout).toContain("kind: Deployment");
    expect(without.stdout).not.toMatch(/CONSOLE_SIGNING_KEY|_PERSON_KEYS/);
  });
});
