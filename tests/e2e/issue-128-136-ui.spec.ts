import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  teams,
  staffRoles,
  editionState,
  tournamentStages,
} from "../../src/db/schema";
import { seedSession } from "./session";
import { seedBrowserEditions } from "./setup";
import { seedResultReview } from "../fixtures/results";
import { fixtureCommand } from "../../src/lib/fixtures";
import { assertTestDatabase } from "../database";
const origin = "http://127.0.0.1:3100";
test.describe("operations presentation batch", () => {
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
  });
  test.afterEach(seedBrowserEditions);
  test.afterAll(closeDb);
  test("fixture workspace stays compact with varied matches across themes and mobile", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    const actor = {
      osuId: isMobile ? 70001 : 60001,
      username: "Synthetic Admin",
    };
    await context.addCookies([await seedSession(actor.osuId)]);
    await seedSession(60101);
    const seeded = await seedResultReview(actor.osuId, 60101, 1301000);
    await db()
      .update(teams)
      .set({
        name: "Synthetic long team " + "長隊名 Long team name ".repeat(6),
      })
      .where(eq(teams.id, seeded.home.teamId));
    const f = seeded.context.fixture;
    for (const [index, status] of (
      ["scheduled", "in_progress", "cancelled"] as const
    ).entries())
      await fixtureCommand(actor, "test-cup", {
        action: "create",
        confirmed: true,
        label: [
          "TBD unplanned",
          "Live long matchup",
          "Cancelled historical match",
        ][index],
        roundId: f.roundId,
        homeTeamId: index === 1 ? seeded.home.teamId : null,
        awayTeamId: index === 1 ? seeded.away.teamId : null,
        position: index + 2,
        scheduledAt: index === 1 ? "2026-11-01T12:00:00Z" : null,
        timeZone: "Asia/Taipei",
        status,
        mappoolId: null,
        homeSourceId: null,
        homeSourceOutcome: null,
        awaySourceId: null,
        awaySourceOutcome: null,
        refereeIds: index === 1 ? [60101] : [],
      });
    const route = "/admin/tournaments/test-cup/matches";
    await page.goto(route);
    await expect(page.locator(".fixture-card")).toHaveCount(4);
    if (process.env.OCLR_VISUAL_BASELINE) {
      await page.screenshot({
        path: info.outputPath("fixtures-before.png"),
        fullPage: true,
      });
      return;
    }
    await page
      .getByRole("tab", { name: "Competition configuration", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add group", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", {
        name: "Configure groups in team management",
        exact: true,
      })
      .click();
    const groups = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Approved Group Stage assignments",
          exact: true,
        }),
      })
      .last();
    await groups
      .getByRole("button", { name: "Add group", exact: true })
      .click();
    await groups
      .getByLabel("Group name 1", { exact: true })
      .fill("Synthetic group");
    await expect(
      groups.getByLabel("Group identifier 1", { exact: true }),
    ).toHaveCount(0);
    for (const check of await groups
      .locator('fieldset input[type="checkbox"]')
      .all())
      await check.check();
    await groups
      .getByRole("button", { name: "Save group assignments", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const stored = (await db().select().from(tournamentStages)).find(
      (s) => s.kind === "group",
    )!.groupConfiguration!.groups[0];
    // Finish the refresh from the saved mutation before editing the next draft.
    await page.reload();
    await groups
      .getByLabel("Group name 1", { exact: true })
      .fill("Renamed group");
    await groups
      .getByRole("button", { name: "Save group assignments", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(
      (await db().select().from(tournamentStages)).find(
        (s) => s.kind === "group",
      )!.groupConfiguration!.groups[0].key,
    ).toBe(stored.key);
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"])
        for (const appearance of ["default", "cute-pastel"]) {
          await context.addCookies(
            [
              ["oclr-locale", locale],
              ["oclr-theme", theme],
              ["oclr-appearance", appearance],
            ].map(([name, value]) => ({ name, value, url: origin })),
          );
          await page.goto(route);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await expect(page.locator(".fixture-matchup")).toHaveCount(4);
          if (locale === "en")
            expect(
              (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                  .analyze()
              ).violations,
            ).toEqual([]);
          await page.screenshot({
            path: info.outputPath(
              `fixtures-after-${locale}-${theme}-${appearance}.png`,
            ),
            fullPage: true,
          });
        }
  });
  test("mappool line tabs retain unsaved settings and bulk input", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const actor = isMobile ? 70001 : 60001;
    await context.addCookies([await seedSession(actor)]);
    await seedSession(60101);
    await seedResultReview(actor, 60101, 1351000, "group", true);
    await page.goto("/admin/tournaments/test-cup/mappools");
    const tools = page.getByRole("tablist", {
      name: "Pool tools",
      exact: true,
    });
    await expect(tools).toHaveAttribute("data-appearance", "line");
    await tools
      .getByRole("tab", { name: "Pool settings", exact: true })
      .click();
    const name = page.getByLabel("Pool name", { exact: true });
    await name.fill("Unsaved pool name");
    await tools.getByRole("tab", { name: "Bulk import", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Map rows", exact: true })
      .fill("NM4 123\nHD1 456");
    await tools
      .getByRole("tab", { name: "Pool settings", exact: true })
      .click();
    await expect(name).toHaveValue("Unsaved pool name");
    await tools.getByRole("tab", { name: "Bulk import", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Map rows", exact: true }),
    ).toHaveValue("NM4 123\nHD1 456");
    await tools.getByRole("tab", { name: "Maps", exact: true }).click();
    const mods = page.getByRole("tablist", {
      name: "Mod categories",
      exact: true,
    });
    await expect(mods).toHaveAttribute("data-appearance", "line");
    await mods.getByRole("tab", { name: /^NM/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(mods.getByRole("tab", { name: /^HD/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: info.outputPath("mappool-line-tabs.png"),
      fullPage: true,
    });
  });
  test("public staff names and award policy remain readable and system milestones localize literally", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const actor = isMobile ? 70001 : 60001;
    await context.addCookies([await seedSession(actor)]);
    await seedSession(60101);
    await db().insert(staffRoles).values({
      userId: actor,
      role: "admin",
      editionSlug: null,
      grantedBy: actor,
      aboutPublished: true,
    });
    const row = (
      await db()
        .select()
        .from(editionState)
        .where(eq(editionState.slug, "test-cup"))
    )[0];
    const config = structuredClone(row.configuration!);
    config.registration = {
      ...config.registration!,
      opensAt: "2098-01-01T00:00:00Z",
      closesAt: "2099-01-01T00:00:00Z",
      withdrawUntil: "2099-01-02T00:00:00Z",
    };
    config.schedule = [
      { label: "Registration window ends", at: "2099-02-01T00:00:00Z" },
    ];
    await db()
      .update(editionState)
      .set({ configuration: config })
      .where(eq(editionState.slug, "test-cup"));
    // The homepage selects one public edition; unrelated session fixtures
    // must not replace the edition whose registration window is under test.
    await db().execute(
      sql`UPDATE edition_state SET configuration = configuration || '{"published":false}'::jsonb WHERE slug <> 'test-cup'`,
    );
    for (const [locale, expected] of [
      ["en", "Registration opens"],
      ["zh-Hans", "报名将于"],
      ["zh-Hant", "報名將於"],
    ]) {
      await context.addCookies([
        { name: "oclr-locale", value: locale, url: origin },
      ]);
      await page.goto("/");
      await expect(page.locator(".home-registration-label")).toContainText(
        expected,
      );
      await expect(page.locator(".home-registration-label")).toContainText(
        "2098",
      );
      await page.reload();
      await expect(page.locator(".home-registration-label")).toContainText(
        expected,
      );
      await page.goto("/tournaments/test-cup");
      await expect(
        page
          .locator("#schedule")
          .getByText("Registration window ends", { exact: true }),
      ).toBeVisible();
      for (const theme of ["light", "dark"])
        for (const appearance of ["default", "cute-pastel"]) {
          await context.addCookies([
            { name: "oclr-theme", value: theme, url: origin },
            { name: "oclr-appearance", value: appearance, url: origin },
          ]);
          await page.goto("/about");
          const staff = page.locator(".public-staff-list > li");
          expect(await staff.allTextContents()).not.toEqual([]);
          expect((await staff.allTextContents()).join("")).not.toContain("↗");
          await expect(staff.first().getByRole("link")).toHaveAttribute(
            "href",
            `https://osu.ppy.sh/users/${actor}`,
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: info.outputPath(`staff-${locale}-${theme}-${appearance}.png`),
            fullPage: true,
          });
          await page.goto("/tournaments/test-cup/results/awards");
          const policy = page.locator("section[aria-labelledby]").filter({
            has: page.getByRole("heading", {
              name: /Award policy|獎項規則|奖项规则/,
            }),
          });
          await expect(policy).toBeVisible();
          await expect(policy.locator("summary")).toHaveCount(0);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: info.outputPath(
              `public-policy-${locale}-${theme}-${appearance}.png`,
            ),
            fullPage: true,
          });
        }
    }
  });
});
