import { scenario } from "@opensoftware/testkit";
import { foreman, serving } from "./console.ts";

/**
 * The queries after "/theme?to=light", with `next` encoded as a link would carry it: six to another site or no address
 * at all, one without a next, and the last a page of the console.
 */
const QUERIES = [
  "&next=/%09/evil.example/x",
  "&next=/%0A/evil.example/x",
  "&next=/%5Cevil.example/x",
  "&next=/%5C%09evil.example/x",
  `&next=${encodeURIComponent("https://evil.example/x")}`,
  `&next=${encodeURIComponent("https://[evil.example")}`,
  "",
  `&next=${encodeURIComponent("/runs?state=failed#top")}`,
];

scenario("SCN-CONSOLE-280", async ({ sut, fakes, given, when, then }) => {
  await given("a foreman with no runs", async () => {
    await serving(sut, [(await foreman(fakes, [])).url]);
  });

  let answers: (number | string | null)[][] = [];
  await when(
    'a program asks for "/theme?to=light" with the next "/%09/evil.example/x", "/%0A/evil.example/x", "/%5Cevil.example/x", "/%5C%09evil.example/x", "https://evil.example/x" and "https://[evil.example", without a next, and with the next "/runs?state=failed#top"',
    async () => {
      answers = await Promise.all(
        QUERIES.map(async (query) => {
          const answer = await fetch(`${sut.http.url()}/theme?to=light${query}`, { redirect: "manual" });
          return [answer.status, answer.headers.get("location")];
        }),
      );
    },
  );

  await then('each of the first seven answers 303 to "/"', async () => {
    expect(answers.slice(0, 7)).toEqual(Array(7).fill([303, "/"]));
  });

  await then('the last answers 303 to "/runs?state=failed#top"', async () => {
    expect(answers[7]).toEqual([303, "/runs?state=failed#top"]);
  });
});
