import { englishStorage } from "../fixtures/preferences";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db, closeDb } from "../../src/db";
import {
  fixtures,
  staffRoles,
  teams,
  tournamentStages,
  tournamentRounds,
} from "../../src/db/schema";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { seedSession } from "./session";
import { captureResponsiveLayout } from "./responsive";
test.describe("streaming workspace through real HTTP sessions", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.setTimeout(240000);
  test.afterAll(async () => closeDb());
  test("books, assigns, cancels and revokes with private boundaries across appearances and locales", async ({
    page,
    context,
    browser,
    isMobile,
    baseURL,
  }, info) => {
    const origin = baseURL!;
    const adminId = isMobile ? 70001 : 60001;
    const streamerId = isMobile ? 187102 : 187002;
    const otherId = streamerId + 1;
    const slug = `streaming-${isMobile ? "mobile" : "desktop"}-test`;
    const adminCookie = await seedSession(adminId);
    const streamerCookie = await seedSession(streamerId);
    const otherCookie = await seedSession(otherId);
    const developerCookie = await seedSession(otherId + 1);
    await seedEditions([
      {
        ...edition,
        slug,
        name: "Synthetic streaming edition",
        published: false,
      },
    ]);
    await db()
      .insert(staffRoles)
      .values(
        [streamerId, otherId].map((userId) => ({
          userId,
          role: "streamer" as const,
          editionSlug: slug,
          grantedBy: adminId,
        })),
      );
    await db()
      .insert(staffRoles)
      .values({
        userId: otherId + 1,
        role: "developer",
        editionSlug: null,
        grantedBy: adminId,
      });
    const [stage] = await db()
      .insert(tournamentStages)
      .values({ editionSlug: slug, kind: "knockout" })
      .returning();
    const [round] = await db()
      .insert(tournamentRounds)
      .values({
        editionSlug: slug,
        stageId: stage.id,
        name: "Internal streaming round",
        position: 1,
      })
      .returning();
    const [team] = await db()
      .insert(teams)
      .values({
        editionSlug: slug,
        captainId: streamerId,
        name: "Synthetic exceptionally long streaming preparation team name 长队名測試".repeat(
          3,
        ),
      })
      .returning();
    const [fixture, second] = await db()
      .insert(fixtures)
      .values(
        [1, 2].map((position) => ({
          editionSlug: slug,
          roundId: round.id,
          label: `Synthetic streaming fixture ${position}`,
          homeTeamId: team.id,
          timeZone: "Asia/Taipei",
          scheduledAt: new Date("2030-02-01T12:00:00Z"),
          position,
        })),
      )
      .returning();
    await context.addCookies([streamerCookie]);
    const manager = await browser.newContext({
      baseURL: origin,
      storageState: {
        cookies: [
          {
            name: "oclr-locale",
            value: "en",
            domain: "127.0.0.1",
            path: "/",
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      },
    });
    const other = await browser.newContext({
      baseURL: origin,
    });
    const guest = await browser.newContext({
      baseURL: origin,
    });
    const developer = await browser.newContext({
      baseURL: origin,
      storageState: englishStorage,
    });
    await developer.addCookies([developerCookie]);
    await manager.addCookies([adminCookie]);
    await other.addCookies([otherCookie]);
    const endpoint = `/api/admin/tournaments/${slug}/streaming/${fixture.id}`;
    const headers = { origin };
    const command = (action: string, revision: number, userId?: number) => ({
      action,
      expectedRevision: revision,
      expectedFixtureVersion: 0,
      confirmed: true,
      requestKey: randomUUID(),
      ...(userId ? { userId } : {}),
    });
    try {
      expect((await guest.request.get(endpoint)).status()).toBe(401);
      const developerData = await (
        await developer.request.get(endpoint)
      ).json();
      expect(developerData.canManage).toBe(false);
      expect(developerData.canSelect).toBe(false);
      for (const action of ["select", "cancel", "reconfirm", "assign"])
        expect(
          (
            await developer.request.post(endpoint, {
              headers,
              data: command(
                action,
                0,
                action === "assign" ? streamerId : undefined,
              ),
            })
          ).status(),
        ).toBe(403);
      const developerPage = await developer.newPage();
      await developerPage.goto(`/admin/tournaments/${slug}/streaming`);
      await expect(
        developerPage.getByRole("heading", {
          name: "Streaming tasks",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        developerPage.getByRole("button", { name: "Apply filters" }),
      ).toBeEnabled();
      await expect(
        developerPage.getByRole("button", {
          name: /Stream this match|Assign Streamer|Cancel streaming task/,
        }),
      ).toHaveCount(0);
      await developerPage.close();
      expect(
        (
          await context.request.get(`/api/admin/tournaments/test-cup/streaming`)
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(`/api/admin/tournaments/${slug}/matches`, {
            headers,
            data: {},
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.get(`/api/admin/registrations?edition=${slug}`)
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.get(`/api/admin/tournaments/${slug}/mappools`)
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(endpoint, {
            headers: { origin: "https://example.invalid" },
            data: command("select", 0),
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(endpoint, {
            headers,
            data: command("assign", 0, otherId),
          })
        ).status(),
      ).toBe(403);
      await page.goto(`/admin/tournaments/${slug}/streaming`);
      await expect(
        page.getByRole("link", { name: "Streaming API access", exact: true }),
      ).toHaveCount(0);
      const filters = page
        .getByRole("button", { name: "Apply filters", exact: true })
        .locator("..")
        .locator("..");
      await expect(filters).not.toHaveClass(/panel/);
      const card = page.getByRole("article", {
        name: fixture.label,
        exact: true,
      });
      await card
        .getByRole("button", { name: "Stream this match", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Confirm", exact: true }),
      ).toBeFocused();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        card.getByText("Self-selected", { exact: false }),
      ).toBeVisible();
      const saved = await (await context.request.get(endpoint)).json();
      expect(saved.fixtures[0].assignment.userId).toBe(streamerId);
      expect(
        (
          await other.request.post(endpoint, {
            headers,
            data: command("cancel", 1),
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await other.request.post(endpoint, {
            headers,
            data: command("select", 1),
          })
        ).status(),
      ).toBe(409);
      await page
        .getByRole("link", { name: "My streaming tasks", exact: true })
        .click();
      await expect(page.getByRole("article")).toHaveCount(1);
      await page
        .getByLabel("Date (match time zone)", { exact: true })
        .fill("2030-02-02");
      await page.getByRole("button", { name: "Apply filters" }).click();
      await expect(
        page.getByText("No streaming tasks match these filters."),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "My streaming tasks", exact: true })
        .click();
      await expect(page.getByRole("article")).toHaveCount(1);
      await card
        .getByRole("link", { name: fixture.label, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Streaming task history" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Import" })).toHaveCount(0);
      await card.getByRole("button", { name: "Cancel streaming task" }).click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(card.getByText("No Streamer assigned")).toBeVisible();
      const managerPage = await manager.newPage();
      await managerPage.goto(`/admin/tournaments/${slug}/streaming`);
      const managerCard = managerPage.getByRole("article", {
        name: fixture.label,
        exact: true,
      });
      await managerCard
        .getByRole("combobox", { name: /^Assign Streamer/ })
        .selectOption(String(streamerId));
      await managerCard
        .getByRole("button", { name: "Assign Streamer", exact: true })
        .click();
      await managerPage
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(
        managerCard.getByText("Staff-assigned", { exact: false }),
      ).toBeVisible();
      await captureResponsiveLayout(managerPage, info, "streaming-manager");
      await page.reload();
      await expect(
        card.getByText("Staff-assigned", { exact: false }),
      ).toBeVisible();
      expect(
        (
          await context.request.post(
            `/api/admin/tournaments/${slug}/streaming/${second.id}`,
            { headers, data: command("select", 0) },
          )
        ).status(),
      ).toBe(200);
      await page.goto(`/admin/tournaments/${slug}/streaming`);
      await expect(page.getByText(/Same start time as:/)).toHaveCount(2);
      for (const appearance of ["default", "cute-pastel", "swiss-minimal"])
        for (const theme of ["light", "dark"])
          for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
            await context.addCookies([
              {
                name: "oclr-locale",
                value: locale,
                url: origin,
              },
              {
                name: "oclr-theme",
                value: theme,
                url: origin,
              },
              {
                name: "oclr-appearance",
                value: appearance,
                url: origin,
              },
            ]);
            await page.goto(`/admin/tournaments/${slug}/streaming?view=mine`);
            await expect(page.locator("h1")).toHaveText(
              locale === "en"
                ? "Streaming tasks"
                : locale === "zh-Hans"
                  ? "直播任务"
                  : "直播任務",
            );
            await expect(page.getByRole("article")).toHaveCount(2);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await expect(page.locator(".themed-site")).toHaveCSS(
              "color-scheme",
              theme,
            );
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            expect
              .soft(
                axe.violations.map((v) => ({
                  id: v.id,
                  nodes: v.nodes.map((n) => n.target),
                })),
              )
              .toEqual([]);
            if (locale === "en")
              await page.screenshot({
                path: info.outputPath(`streaming-${appearance}-${theme}.png`),
                fullPage: true,
              });
          }
      await captureResponsiveLayout(page, info, "streaming-tasks");
      const grant = (
        await (await manager.request.get("/api/admin/staff")).json()
      ).grants.find(
        (g: { grant: { userId: number; editionSlug: string } }) =>
          g.grant.userId === streamerId && g.grant.editionSlug === slug,
      ).grant;
      expect(
        (
          await manager.request.post("/api/admin/staff", {
            headers,
            data: { action: "revoke", grantId: grant.id, confirmed: true },
          })
        ).status(),
      ).toBe(200);
      expect((await context.request.get(endpoint)).status()).toBe(403);
      expect(
        (
          await context.request.post(endpoint, {
            headers,
            data: command("cancel", 3),
          })
        ).status(),
      ).toBe(403);
      const retained = await (await manager.request.get(endpoint)).json();
      expect(retained.fixtures[0].assignment.eligible).toBe(false);
      expect(
        (
          await guest.request.get(
            `/api/tournaments/${slug}/matches/${fixture.id}`,
          )
        ).status(),
      ).toBe(404);
    } finally {
      await Promise.all([
        manager.close(),
        other.close(),
        guest.close(),
        developer.close(),
      ]);
    }
  });
});
