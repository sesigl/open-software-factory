import { scenario } from "@opensoftware/testkit";
import { serving, submittingIntake } from "./console.ts";
import { signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-145", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof submittingIntake>>;
  await given('a person "ada@acme.dev" signed in to a console with intake', async () => {
    const setup = await signInEnv(sut, fakes);
    intake = await submittingIntake(fakes);
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], { ...setup.env, CONSOLE_INTAKE_URL: intake.url });
    setup.oidc.signIn({ email: "ada@acme.dev" });
    expect((await signedIn(sut)).path).toBe("/");
  });

  let answer: Awaited<ReturnType<typeof sut.pages.send>>;
  await when(
    'a program sends the form "submit work" with the person\'s session and the Origin "https://evil.example"',
    async () => {
      // The console's own address: a request for 127.0.0.1 is sent there first.
      answer = await sut.pages.send(
        `http://localhost:${new URL(sut.http.url()).port}/work`,
        { title: "Steal the factory" },
        { headers: { origin: "https://evil.example" }, follow: false },
      );
    },
  );

  await then('the answer has the status 403 and says "the form came from another site"', async () => {
    expect(answer.status).toBe(403);
    expect(answer.text).toContain("the form came from another site");
  });

  await then("intake received no submission", async () => {
    expect(intake.received().filter(({ method }) => method === "POST")).toEqual([]);
  });
});
