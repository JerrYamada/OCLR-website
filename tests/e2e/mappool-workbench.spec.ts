import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  staffRoles,
  mappoolCandidates,
  mappoolCandidateComments,
} from "../../src/db/schema";
import { seedSession } from "./session";
import { openTournamentTool } from "./navigation";
const origin = process.env.OCLR_TEST_ORIGIN || "http://127.0.0.1:3100";
const endpoint = "/api/admin/tournaments/test-cup/mappool-workbench";
test.describe("private Pooler/Tester selection workbench", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("batch preview, two-author comments, lost response retry and private readable layout", async ({
    page,
    context,
    browser,
    isMobile,
  }) => {
    const testerId = isMobile ? 572110 : 572100,
      poolerId = testerId + 1;
    const cookie = await seedSession(testerId),
      poolerCookie = await seedSession(poolerId);
    await db().delete(mappoolCandidateComments);
    await db().delete(mappoolCandidates);
    await db()
      .insert(staffRoles)
      .values([
        {
          userId: testerId,
          role: "tester",
          editionSlug: "test-cup",
          grantedBy: testerId,
        },
        {
          userId: poolerId,
          role: "mappooler",
          editionSlug: "test-cup",
          grantedBy: testerId,
        },
      ]);
    await context.addCookies([cookie]);
    await context.route("https://assets.ppy.sh/**", (route) => route.abort());
    const guest = await browser.newContext({ baseURL: origin });
    const pooler = await browser.newContext({ baseURL: origin });
    await pooler.addCookies([poolerCookie]);
    try {
      expect((await guest.request.get(endpoint)).status()).toBe(401);
      expect(
        (
          await context.request.post(endpoint, {
            headers: { Origin: "https://wrong.example" },
            data: { action: "preview", text: "123" },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(
            "/api/admin/tournaments/test-cup/mappools",
            { headers: { Origin: origin }, data: {} },
          )
        ).status(),
      ).toBe(403);
      await openTournamentTool(
        page,
        "test-cup",
        "Map selection workbench",
        isMobile,
      );
      await page
        .getByLabel("Beatmap IDs or difficulty URLs")
        .fill("123\nnot-a-bid\nhttps://osu.ppy.sh/beatmaps/123\n456");
      await page
        .getByRole("button", { name: "Preview candidates", exact: true })
        .click();
      await expect(page.getByText(/Row 2 · Invalid BID/)).toBeVisible();
      await expect(page.getByText(/Row 3 · Duplicate/)).toBeVisible();
      await page
        .getByRole("button", {
          name: "Add selected candidates (2)",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", { name: "Candidate maps (2)", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Beatmap IDs or difficulty URLs"),
      ).toHaveValue("not-a-bid");
      await page.reload();
      const candidate = page.getByRole("article", {
        name: "BID 123",
        exact: true,
      });
      const workspace = await (await pooler.request.get(endpoint)).json();
      const id = workspace.candidates.find(
        (c: { beatmapId: number }) => c.beatmapId === 123,
      ).id;
      expect(
        (
          await pooler.request.post(endpoint, {
            headers: { Origin: origin },
            data: {
              action: "comment",
              candidateId: id,
              requestId: crypto.randomUUID(),
              body: "Synthetic Pooler feedback",
            },
          })
        ).status(),
      ).toBe(200);
      expect(
        (await guest.request.get(`${endpoint}/${id}/comments`)).status(),
      ).toBe(401);
      await candidate.getByText("Comments (0)", { exact: true }).click();
      await expect(
        candidate.getByText("Synthetic Pooler feedback"),
      ).toBeVisible();
      const feedback =
        "Synthetic Tester feedback <script>window.executed = true</script>";
      await candidate.getByLabel("Your comment").fill(feedback);
      await context.route(`**${endpoint}`, async (route) => {
        if (
          route.request().method() === "POST" &&
          route.request().postDataJSON().action === "comment"
        ) {
          await route.fetch();
          await route.abort("failed");
        } else await route.continue();
      });
      await candidate
        .getByRole("button", { name: "Post comment", exact: true })
        .click();
      await expect(candidate.getByRole("alert")).toBeVisible();
      await expect(candidate.getByLabel("Your comment")).toHaveValue(feedback);
      await context.unroute(`**${endpoint}`);
      await candidate
        .getByRole("button", { name: "Post comment", exact: true })
        .click();
      await expect(
        candidate.getByText(feedback, { exact: true }),
      ).toBeVisible();
      await expect(
        candidate.getByText("Comments (2)", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => (window as Window & { executed?: boolean }).executed,
        ),
      ).toBeUndefined();
      expect(
        await db()
          .select()
          .from(mappoolCandidateComments)
          .where(eq(mappoolCandidateComments.candidateId, id)),
      ).toHaveLength(2);
      for (const theme of ["light", "dark"]) {
        await context.addCookies([
          { name: "oclr-theme", value: theme, url: origin },
        ]);
        await page.reload();
        const row = page.getByRole("article", { name: "BID 123", exact: true });
        await row.getByText("Comments (2)", { exact: true }).click();
        await expect(row.getByText(feedback, { exact: true })).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        expect(
          (await new AxeBuilder({ page }).include(".workspace-main").analyze())
            .violations,
        ).toEqual([]);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `/tmp/oclr-572-${isMobile ? "mobile" : "desktop"}-${theme}.png`,
          fullPage: true,
        });
      }
      for (const [locale, heading] of [
        ["zh-Hans", "选图工作台"],
        ["zh-Hant", "選圖工作臺"],
      ]) {
        await context.addCookies([
          { name: "oclr-locale", value: locale, url: origin },
        ]);
        await page.reload();
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
      }
      await db()
        .update(staffRoles)
        .set({ revokedAt: new Date() })
        .where(eq(staffRoles.userId, testerId));
      expect((await context.request.get(endpoint)).status()).toBe(403);
      expect(
        (await context.request.get(`${endpoint}/${id}/comments`)).status(),
      ).toBe(403);
    } finally {
      await guest.close();
      await pooler.close();
    }
  });
});
