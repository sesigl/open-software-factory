import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN } from "./secrets.ts";
import { needsOf, servingSkills, skillOf } from "./skills.ts";

/** A port of the loopback where nothing listens: the first port, which only root may open. */
const CLOSED = "http://127.0.0.1:1";

scenario("SCN-CONSOLE-193", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" whose agent "triage" gives "LINEAR_TOKEN" with "ref:openbao/linear-token", and "OSF_OPENBAO_ADDR" names a port where nothing listens',
    async () => {
      const skill = skillOf(
        "release-notes",
        { triage: { secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } } },
        { needs: { secrets: ["LINEAR_TOKEN"], hosts: [] } },
      );
      await servingSkills(sut, fakes, { triage: { secrets: ["ref:openbao/linear-token"] } }, [skill], {
        OSF_OPENBAO_ADDR: CLOSED,
      });
    },
  );

  let page: Page;
  await when('the admin opens "/skills"', async () => {
    page = await sut.pages.open("/skills", { headers: ADMIN });
  });

  await then('the page says "The secrets could not be listed: the store at <address> does not answer"', async () => {
    expect(page.getByRole("alert").text).toBe(
      `The secrets could not be listed: the store at ${CLOSED} does not answer`,
    );
  });

  await then('"release-notes" needs the secret "LINEAR_TOKEN", "Unknown"', async () => {
    expect(needsOf(page, "release-notes")).toEqual(["Secret LINEAR_TOKEN Unknown"]);
  });
});
