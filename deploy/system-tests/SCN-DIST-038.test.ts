import { scenario } from "@opensoftware/testkit";
import { cluster, rendered, values } from "./chart.ts";

/** An environment variable of a container that names its value, as "helm template" renders it. */
const value = (name: string, text: string) => new RegExp(`- name: ${name}\\n\\s+value: "${text}"\\n`);
/** An environment variable of a container from a key of a Secret. */
const fromSecret = (name: string, secret: string, key: string) =>
  new RegExp(`- name: ${name}\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+name: ${secret}\\n\\s+key: ${key}\\n`);

scenario("SCN-DIST-038", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given(
    'a values file that sets every value under "secrets", and under "console.signIn" the provider "oidc", its issuer, its client ID, the address "https://factory.acme.dev" and the Secret "osf-sign-in"',
    async () => {
      await values(
        sut,
        [],
        {},
        [
          "console:",
          "  signIn:",
          "    provider: oidc",
          "    url: https://factory.acme.dev",
          "    issuer: https://id.acme.dev",
          "    clientId: factory-console",
          "    secret: osf-sign-in",
          "",
        ].join("\n"),
      );
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
    'the deployment "console" sets "CONSOLE_SIGN_IN", "CONSOLE_URL", "CONSOLE_OIDC_ISSUER" and "CONSOLE_OIDC_CLIENT_ID" to the values, and "CONSOLE_SESSION_SECRET" and "CONSOLE_OIDC_CLIENT_SECRET" from the keys "session-secret" and "client-secret" of the Secret "osf-sign-in"',
    async () => {
      const console = rendered(result.stdout, "console.yaml");
      expect(console).toMatch(value("CONSOLE_SIGN_IN", "oidc"));
      expect(console).toMatch(value("CONSOLE_URL", "https://factory.acme.dev"));
      expect(console).toMatch(value("CONSOLE_OIDC_ISSUER", "https://id.acme.dev"));
      expect(console).toMatch(value("CONSOLE_OIDC_CLIENT_ID", "factory-console"));
      expect(console).toMatch(fromSecret("CONSOLE_SESSION_SECRET", "osf-sign-in", "session-secret"));
      expect(console).toMatch(fromSecret("CONSOLE_OIDC_CLIENT_SECRET", "osf-sign-in", "client-secret"));
    },
  );

  await then('the console\'s readiness probe asks "/v1/ready" for the host "factory.acme.dev"', async () => {
    expect(rendered(result.stdout, "console.yaml")).toMatch(
      /readinessProbe:\n(?:\s+#.*\n)*\s+httpGet:\n\s+path: \/v1\/ready\n\s+port: http\n\s+httpHeaders:\n\s+- name: Host\n\s+value: "factory.acme.dev"\n/,
    );
  });

  await then("no manifest of the chart is a Secret with a key of the sign-in", async () => {
    const secrets = result.stdout.split(/^---$/m).filter((document) => /^kind: Secret$/m.test(document));
    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets.filter((secret) => /session-secret|client-secret|osf-sign-in/.test(secret))).toEqual([]);
  });
});
