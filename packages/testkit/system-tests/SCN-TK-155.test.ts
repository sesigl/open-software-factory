import { scenario } from "@opensoftware/testkit";
import { pageModule, testCases } from "./module.ts";

const FORM = [
  '<!doctype html><html lang="en"><head><title>Name</title></head><body><main>',
  '<form method="post" action="/name"><input type="hidden" name="greeting" value="Hello">',
  '<label>Name <input name="name"></label><button type="submit">Save</button></form></main></body></html>',
].join("");

// The server's routes: the form sets the cookie, /hello greets it and the header, /sign-out clears the cookie.
const ROUTES = [
  'if (url.pathname === "/name") {',
  '  response.writeHead(303, { "set-cookie": `name=${form.get("name")}; Path=/; HttpOnly`, location: `/hello?greeting=${form.get("greeting")}` });',
  "  return response.end();",
  "}",
  'if (url.pathname === "/hello") {',
  '  const name = /name=([^;]+)/.exec(request.headers.cookie ?? "")?.[1] ?? "stranger";',
  '  response.writeHead(200, { "content-type": "text/html" });',
  '  return response.end(`<!doctype html><title>Hello</title><h1>${url.searchParams.get("greeting")} ${name} from ${request.headers["x-demo-proxy"]}</h1><a href="/sign-out">Sign out</a>`);',
  "}",
  'if (url.pathname === "/sign-out") {',
  '  response.writeHead(303, { "set-cookie": "name=; Path=/; Max-Age=0", location: "/hello?greeting=Bye" });',
  "  return response.end();",
  "}",
];

scenario("SCN-TK-155", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose form "Save" sets the cookie of the field "Name" and redirects to a page that greets the cookie and the header "x-demo-proxy", and whose link "Sign out" clears the cookie',
    async () => {
      module = pageModule(
        { "/": FORM },
        ROUTES,
        ['When the user saves the name "Ada" and signs out', "Then the pages greet Ada and then a stranger"],
        [
          "await sut.http.start();",
          "let sent: Awaited<ReturnType<typeof sut.pages.open>>;",
          "let hello: Awaited<ReturnType<typeof sut.pages.open>>;",
          "let bye: Awaited<ReturnType<typeof sut.pages.open>>;",
          "let program: Awaited<ReturnType<typeof sut.pages.open>>;",
          "await when('the user saves the name \"Ada\" and signs out', async () => {",
          '  const form = await sut.pages.open("/", { headers: { "x-demo-proxy": "proxy" } });',
          '  sent = await form.submit("Save", { Name: "Ada" }, { follow: false });',
          '  hello = await form.submit("Save", { Name: "Ada" });',
          '  bye = await hello.follow("Sign out");',
          '  program = await sut.pages.send("/name", { name: "Bob", greeting: "Hi" }, { headers: { "x-demo-proxy": "a program" } });',
          "});",
          "await then('the pages greet Ada and then a stranger', async () => {",
          "  expect(sent.status).toBe(303);",
          '  expect(sent.location).toBe("/hello?greeting=Hello");',
          '  expect(hello.path).toBe("/hello?greeting=Hello");',
          '  expect(hello.getByRole("heading").text).toBe("Hello Ada from proxy");',
          '  expect(bye.getByRole("heading").text).toBe("Bye stranger from proxy");',
          '  expect(program.getByRole("heading").text).toBe("Hi Bob from a program");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test opens "/" with the header "x-demo-proxy" "proxy", sends "Save" with "Name" "Ada" once without following its redirect and once following it, then follows "Sign out", and sends the field "name" "Bob" to "/name" as a program',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
