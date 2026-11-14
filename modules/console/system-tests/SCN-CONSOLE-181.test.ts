import { scenario } from "@opensoftware/testkit";
import { ADMIN, type Store, servingSecrets, VALUE } from "./secrets.ts";

/** One answer of the console as it came: its status, every header and the whole body. */
interface Answer {
  status: number;
  headers: string;
  body: string;
}

scenario("SCN-CONSOLE-181", async ({ sut, fakes, given, when, then }) => {
  let store: Store;
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"',
    async () => {
      store = await servingSecrets(sut, fakes, { triage: { secrets: ["ref:openbao/linear-token"] } });
    },
  );

  const answers: Answer[] = [];
  /** Asks the console as a browser would, without following a redirect, and keeps the whole answer. */
  const ask = async (path: string, form?: Record<string, string>): Promise<Answer> => {
    const response = await fetch(new URL(path, sut.http.url()), {
      method: form ? "POST" : "GET",
      headers: { ...ADMIN, ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
      body: form && new URLSearchParams(form).toString(),
      redirect: "manual",
    });
    const answer = {
      status: response.status,
      headers: JSON.stringify([...response.headers]),
      body: await response.text(),
    };
    answers.push(answer);
    return answer;
  };

  await when(
    '"ada@acme.dev" opens "/secrets", stores a value for "linear-token", opens the page it is sent to, and sends the same value for the name "team/../linear-token" and in a form over 64 KiB',
    async () => {
      await ask("/secrets");
      const stored = await ask("/secrets", { name: "linear-token", value: VALUE });
      await ask(JSON.parse(stored.headers).find(([name]: string[]) => name === "location")[1]);
      await ask("/secrets", { name: "team/../linear-token", value: VALUE });
      await ask("/secrets", { name: "linear-token", value: VALUE.repeat(3000) });
    },
  );

  await then('the store holds the value for "linear-token"', async () => {
    expect(await store.bao.read("linear-token")).toEqual({ version: 1, data: { value: VALUE } });
  });

  await then(
    "no page, header or redirect that the console answered and nothing that it printed holds the value",
    async () => {
      expect(answers.map(({ status }) => status)).toEqual([200, 303, 200, 400, 413]);
      const printed = sut.http.output();
      const outputs = [...answers.flatMap(({ headers, body }) => [headers, body]), printed.stdout, printed.stderr];
      // The whole value, and a part of it, as a cut-off error message would hold it.
      expect(outputs.filter((output) => output.includes(VALUE) || output.includes("value_51c2"))).toEqual([]);
    },
  );
});
