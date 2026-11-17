import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-037", async ({ fakes, given, when, then }) => {
  let api: FakeHttp;
  await given(
    'fakes.http with the answer "<h1>Pay with a card</h1>" with the content type "text/html" for "GET /checkout"',
    async () => {
      api = await fakes.http([{ path: "/checkout", contentType: "text/html", body: "<h1>Pay with a card</h1>" }]);
    },
  );

  let answer = "";
  await when('a module gets "/checkout" from the fake', async () => {
    const response = await fetch(`${api.url}/checkout`);
    answer = `${response.headers.get("content-type")} ${await response.text()}`;
  });

  await then('the content type and the body are "text/html <h1>Pay with a card</h1>"', async () => {
    expect(answer).toBe("text/html <h1>Pay with a card</h1>");
  });
});
