import { scenario } from "@opensoftware/testkit";
import { serving, submittingIntake } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-156", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof submittingIntake>>;
  await given("a console that signs in with OpenID Connect and intake", async () => {
    const setup = await signInEnv(sut, fakes);
    intake = await submittingIntake(fakes);
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], { ...setup.env, CONSOLE_INTAKE_URL: intake.url });
  });

  let answer: Awaited<ReturnType<typeof sut.pages.send>>;
  await when('a program sends the form "submit work" without a session', async () => {
    const url = `http://localhost:${new URL(sut.http.url()).port}`;
    answer = await sut.pages.send(
      `${url}/work`,
      { title: "Export reports as CSV" },
      { headers: { origin: url }, follow: false },
    );
  });

  await then('the answer has the status 401 and says "sign in first"', async () => {
    expect([answer.status, answer.text]).toEqual([401, "sign in first"]);
  });

  await then("intake received no submission", async () => {
    expect(intake.received().filter(({ method }) => method === "POST")).toEqual([]);
  });
});
