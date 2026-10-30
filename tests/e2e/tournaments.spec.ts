import { englishStorage } from "../fixtures/preferences";
import { selectTimeZone } from "./time-zone";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { editionState, staffRoles } from "../../src/db/schema";
import { seedSession } from "./session";
import { captureResponsiveLayout } from "./responsive";
test.describe("browser-managed authoritative tournament editions", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.setTimeout(90000);
  test.afterAll(async () => closeDb());
  test("quick-creates from a name with optional settings and safe publication", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const adminId = isMobile ? 70001 : 60001;
    const name = `Synthetic quick ${isMobile ? "mobile" : "desktop"}`;
    const slug = name.toLowerCase().replaceAll(" ", "-");
    await context.addCookies([await seedSession(adminId)]);
    await db().delete(editionState).where(eq(editionState.slug, slug));
    await page.goto("/admin/tournaments/new");
    await page.getByLabel("Tournament name", { exact: true }).fill(name);
    await expect(
      page.getByText(`/tournaments/${slug} · Permanent after creation.`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Permanent slug", { exact: true }),
    ).toBeHidden();
    await expect(page.locator("main input:visible")).toHaveCount(1);
    await captureResponsiveLayout(page, info, "minimal-create");
    await page
      .getByRole("button", { name: "Create private draft", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${slug}$`));
    const endpoint = `/api/admin/tournaments/${slug}`;
    const original = await (await context.request.get(endpoint)).json();
    expect(original.edition).toMatchObject({
      slug,
      name,
      coachesEnabled: false,
      summary: "",
      season: null,
      published: false,
      registration: null,
      rules: null,
      schedule: [],
      timeZone: "UTC",
    });
    await page.goto(`/admin/tournaments/${slug}/settings`);
    await expect(page.getByLabel("Season identifier (optional)")).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Square logo", exact: true }),
    ).toBeVisible();
    await captureResponsiveLayout(page, info, "minimal-general");
    await page.getByRole("tab", { name: "Publication", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish tournament", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Add a public summary",
    );
    const failed = await (await context.request.get(endpoint)).json();
    expect(failed.revision).toBe(original.revision);
    expect(failed.edition.published).toBe(false);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("tab", { name: "General", exact: true }).click();
    await expect(page.locator(".tournament-settings details")).toHaveCount(0);
    await expect(page.getByLabel("Season identifier (optional)")).toBeVisible();
    expect((await (await context.request.get(endpoint)).json()).revision).toBe(
      0,
    );
    await page.getByLabel("Season identifier (optional)").fill("Test season");
    await page
      .getByRole("button", { name: "Save general settings", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "saved" }),
    ).toContainText("saved");
    await page.reload();
    await expect(page.getByLabel("Season identifier (optional)")).toHaveValue(
      "Test season",
    );
    await page.goto("/admin/tournaments/new");
    await page.getByLabel("Tournament name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Edit URL", exact: true }).click();
    await page
      .getByLabel("Permanent slug", { exact: true })
      .fill("Invalid / URL");
    await page
      .getByRole("button", { name: "Create private draft", exact: true })
      .click();
    await expect(
      page.getByLabel("Permanent slug", { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/tournaments\/new$/);
    await page.getByLabel("Permanent slug", { exact: true }).fill(slug);
    await page
      .getByLabel("Tournament name", { exact: true })
      .fill("Renamed draft");
    await expect(
      page.getByLabel("Permanent slug", { exact: true }),
    ).toHaveValue(slug);
    await page
      .getByRole("button", { name: "Create private draft", exact: true })
      .click();
    await expect(page.locator("main form").getByRole("alert")).toContainText(
      "already exists",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test("creates, configures and publishes without files, preserving saved acknowledgments and staff boundaries", async ({
    page,
    context,
    browser,
    isMobile,
  }, info) => {
    const adminId = isMobile ? 70001 : 60001;
    const playerId = isMobile ? 340101 : 340001;
    const slug = isMobile ? "managed-mobile-test" : "managed-desktop-test";
    await seedSession(adminId); // Assert the isolated DB before a destructive fixture reset.
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await context.addCookies([await seedSession(adminId)]);
    const guest = await browser.newContext({
      storageState: englishStorage,
      baseURL: "http://127.0.0.1:3100",
    });
    const player = await browser.newContext({
      storageState: englishStorage,
      baseURL: "http://127.0.0.1:3100",
    });
    const limited = await browser.newContext({
      storageState: englishStorage,
      baseURL: "http://127.0.0.1:3100",
    });
    const headers = { origin: "http://127.0.0.1:3100" };
    const endpoint = `/api/admin/tournaments/${slug}`;
    const current = async () => (await context.request.get(endpoint)).json();
    const tab = (name: string) =>
      page
        .getByRole("tablist", { name: "Tournament settings", exact: true })
        .getByRole("tab", { name, exact: true })
        .click();
    try {
      expect((await guest.request.get("/api/admin/tournaments")).status()).toBe(
        401,
      );
      expect(
        (
          await guest.request.post("/api/admin/tournaments", {
            headers,
            data: {},
          })
        ).status(),
      ).toBe(401);
      await page.goto("/admin/tournaments");
      await expect(
        page.getByRole("heading", { name: "OCLR Season 11", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Create tournament", exact: true })
        .click();
      await page
        .getByLabel("Tournament name", { exact: true })
        .fill("Synthetic managed edition");
      await page.getByRole("button", { name: "Edit URL", exact: true }).click();
      await page.getByLabel("Permanent slug", { exact: true }).fill(slug);
      await page
        .getByRole("button", { name: "Create private draft", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${slug}$`));
      await expect(
        page.getByRole("heading", {
          name: "Synthetic managed edition",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /reason|Permanent slug/i }),
      ).toHaveCount(0);
      expect(
        (await guest.request.get(`/api/tournaments/${slug}`)).status(),
      ).toBe(404);
      let state = await current();
      expect(state.edition).toMatchObject({
        published: false,
        registration: null,
        rules: null,
        schedule: [],
      });
      await page.getByRole("link", { name: /^Configure tournament/ }).click();
      const duplicate = {
        slug,
        name: state.edition.name,
        season: "12",
        summary: state.edition.summary,
        timeZone: "Asia/Taipei",
        branding: state.edition.branding,
        confirmed: true,
      };
      expect(
        (
          await context.request.post("/api/admin/tournaments", {
            headers,
            data: duplicate,
          })
        ).status(),
      ).toBe(409);
      await page
        .getByLabel("Tournament name", { exact: true })
        .fill("Synthetic approved edition");
      await page
        .getByLabel("Summary", { exact: true })
        .fill(
          "Synthetic browser-managed configuration, never production content.",
        );
      await selectTimeZone(page, "Asia/Taipei");
      await page
        .getByRole("button", { name: "Save general settings", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await tab("Rules & eligibility");
      await page
        .getByLabel("Configure approved rules", { exact: true })
        .check();
      await page
        .getByLabel("Rules version", { exact: true })
        .fill("synthetic-v1");
      await page
        .getByLabel("Section 1 heading", { exact: true })
        .fill("Original synthetic rules");
      await page
        .getByLabel("Section 1 content", { exact: true })
        .fill("Original synthetic conditions acknowledged by applicants.");
      await page
        .getByLabel("Eligibility disclosure", { exact: true })
        .fill("Synthetic approved disclosure for isolated tests.");
      await page
        .getByRole("button", { name: "Save rules & eligibility", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      await tab("Milestones");
      await page
        .getByRole("button", { name: "Add milestone", exact: true })
        .click();
      await page
        .getByLabel("Milestone 1 label", { exact: true })
        .fill("Synthetic captain announcement");
      await page
        .getByRole("button", { name: "Add milestone", exact: true })
        .click();
      await page
        .getByLabel("Milestone 2 label", { exact: true })
        .fill("Synthetic competition start");
      await page
        .getByLabel("Milestone 2 time: date", { exact: true })
        .fill("2027-04-20");
      await page
        .getByLabel("Milestone 2 time: time (HH:mm)", { exact: true })
        .fill("20:30");
      await page
        .getByRole("button", { name: "Move milestone 2 up", exact: true })
        .click();
      await expect(
        page.getByLabel("Milestone 1 time: date", { exact: true }),
      ).toHaveValue("2027-04-20");
      await page
        .getByRole("button", { name: "Save milestones", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      state = await current();
      expect(state.edition.schedule).toEqual([
        {
          label: "Synthetic competition start",
          at: "2027-04-20T12:30:00.000Z",
        },
        { label: "Synthetic captain announcement", at: null },
      ]);
      await tab("Registration");
      await page
        .getByLabel("Configure registration window", { exact: true })
        .check();
      await page
        .getByLabel("Registration opens: date", { exact: true })
        .fill("2025-01-01");
      await page
        .getByLabel("Registration opens: time (HH:mm)", { exact: true })
        .fill("12:00");
      await page
        .getByLabel("Registration closes: date", { exact: true })
        .fill("2099-01-01");
      await page
        .getByLabel("Registration closes: time (HH:mm)", { exact: true })
        .fill("20:00");
      await expect(
        page.getByRole("button", { name: "Add question", exact: true }),
      ).toBeVisible();
      await page
        .getByLabel("Withdrawal deadline: date", { exact: true })
        .fill("2099-01-01");
      await page
        .getByLabel("Withdrawal deadline: time (HH:mm)", { exact: true })
        .fill("19:00");
      await page
        .getByRole("button", { name: "Add question", exact: true })
        .click();
      await page
        .getByLabel("Question 1 label", { exact: true })
        .fill("Original availability");
      await page.getByLabel("Question 1 is required", { exact: true }).check();
      await page
        .getByLabel("Question 1 maximum length", { exact: true })
        .fill("20");
      await page
        .getByRole("button", {
          name: "Save registration settings",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      await tab("Publication");
      await page
        .getByRole("button", { name: "Publish tournament", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Publication updated." }),
      ).toHaveText("Publication updated.");
      const guestPage = await guest.newPage();
      await guestPage.goto(`/tournaments/${slug}/rules`);
      await expect(
        guestPage.getByRole("heading", { name: "Original synthetic rules" }),
      ).toBeVisible();
      await guestPage.goto(`/tournaments/${slug}`);
      await expect(guestPage.locator(".stage-scroll")).toContainText(
        "Synthetic captain announcement",
      );
      await guestPage.goto(`/tournaments/${slug}/register`);
      await expect(
        guestPage.getByRole("heading", { name: "Registration is not open" }),
      ).toBeVisible();
      const pub = await (
        await guest.request.get(`/api/tournaments/${slug}`)
      ).json();
      expect(pub.registration.state).toBe("paused");
      expect(JSON.stringify(pub)).not.toMatch(
        /questions|actorId|configurationVersion|applications|answers/,
      );
      await tab("Registration");
      await page
        .getByLabel("Enable registration during this window", { exact: true })
        .check();
      await page
        .getByRole("button", {
          name: "Save registration settings",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      state = await current();
      expect(state.edition.registration.enabled).toBe(true);
      expect(
        (await (await guest.request.get(`/api/tournaments/${slug}`)).json())
          .registration.state,
      ).toBe("open");
      await db()
        .update(editionState)
        .set({ registrationPausedAt: new Date() })
        .where(eq(editionState.slug, slug));
      expect(
        (await (await guest.request.get(`/api/tournaments/${slug}`)).json())
          .registration.state,
      ).toBe("closed");
      await db()
        .update(editionState)
        .set({ registrationPausedAt: null })
        .where(eq(editionState.slug, slug));

      await player.addCookies([await seedSession(playerId)]);
      const playerPage = await player.newPage();
      await playerPage.goto(`/tournaments/${slug}/register`);
      const questionId = state.edition.registration.questions[0].id;
      const body = {
        rulesAcknowledged: true,
        eligibilityAcknowledged: true,
        rulesVersion: "synthetic-v1",
        configurationVersion: state.revision,
        answers: { [questionId]: "Evenings" },
      };
      expect(
        (
          await player.request.post(`/api/tournaments/${slug}/registrations`, {
            headers,
            data: { ...body, configurationVersion: state.revision - 1 },
          })
        ).status(),
      ).toBe(409);
      await playerPage
        .getByLabel("Original availability (required)", { exact: true })
        .fill("Evenings");
      await playerPage.getByLabel(/I have read and agree/).check();
      await playerPage.getByLabel(/I have read the eligibility/).check();
      await playerPage
        .getByRole("button", { name: "Submit individual application" })
        .click();
      await expect(playerPage).toHaveURL(/\/dashboard\?submitted=1$/);
      const application = (
        await (await player.request.get("/api/registrations")).json()
      ).find((r: { editionSlug: string }) => r.editionSlug === slug);
      expect(application.configurationVersion).toBe(state.revision);
      await page.reload();
      await tab("Registration");
      await page
        .getByLabel("Enable registration during this window", { exact: true })
        .uncheck();
      await page
        .getByRole("button", {
          name: "Save registration settings",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      await tab("Rules & eligibility");
      await page.getByText("Rules release", { exact: true }).click();
      await page
        .getByLabel("Rules version", { exact: true })
        .fill("synthetic-v2");
      await page
        .getByLabel("Section 1 heading", { exact: true })
        .fill("Revised synthetic rules");
      await page
        .getByRole("button", { name: "Save rules & eligibility", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      await tab("Registration");
      await page
        .getByLabel("Question 1 label", { exact: true })
        .fill("Revised availability");
      await page
        .getByRole("button", {
          name: "Save registration settings",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "saved" }),
      ).toContainText("saved");
      await playerPage.reload();
      await playerPage.getByText("My application", { exact: true }).click();
      await expect(
        playerPage.getByRole("heading", { name: "Original synthetic rules" }),
      ).toHaveCount(0);
      const savedApplication = (
        await (await player.request.get("/api/registrations")).json()
      ).find((r: { id: string }) => r.id === application.id);
      expect(savedApplication.rulesVersion).toBe("synthetic-v1");
      expect(savedApplication.configurationVersion).toBe(
        application.configurationVersion,
      );
      await expect(
        playerPage.getByText("Original availability", { exact: true }),
      ).toBeVisible();
      await expect(
        playerPage.getByText("Revised availability", { exact: true }),
      ).toHaveCount(0);
      const reviewPage = await context.newPage();
      await reviewPage.goto(`/admin/registrations/${application.id}`);
      await expect(
        reviewPage.getByText("Original availability", { exact: true }),
      ).toBeVisible();
      await reviewPage.close();
      await guestPage.goto(`/tournaments/${slug}/rules`);
      await expect(
        guestPage.getByRole("heading", { name: "Revised synthetic rules" }),
      ).toBeVisible();
      await limited.addCookies([await seedSession(playerId + 1)]);
      for (const role of ["mappooler", "referee"] as const)
        await db()
          .insert(staffRoles)
          .values({
            userId: playerId + 1,
            role,
            editionSlug: slug,
            grantedBy: adminId,
          });
      expect((await limited.request.get(endpoint)).status()).toBe(403);
      expect(
        (
          await limited.request.post(endpoint, {
            headers,
            data: {
              action: "publication",
              expectedRevision: (await current()).revision,
              confirmed: true,

              published: false,
            },
          })
        ).status(),
      ).toBe(403);
      const limitedPage = await limited.newPage();
      await limitedPage.goto(`/admin/tournaments/${slug}`);
      await expect(
        limitedPage.getByRole("link", { name: /^Open mappools/ }),
      ).toBeVisible();
      await expect(
        limitedPage.getByRole("tablist", {
          name: "Tournament settings",
          exact: true,
        }),
      ).toHaveCount(0);
      await page.goto(`/admin/staff?edition=${slug}`);
      await expect(
        page.getByRole("combobox", { name: "Scope", exact: true }),
      ).toHaveValue(slug);
      await page.goto(`/admin/tournaments/${slug}/settings`);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("tournament-workspace.png"),
        fullPage: true,
        animations: "disabled",
      });
      await tab("Publication");
      await page
        .getByRole("button", { name: "Unpublish tournament", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Publication updated." }),
      ).toHaveText("Publication updated.");
      expect(
        (await guest.request.get(`/api/tournaments/${slug}`)).status(),
      ).toBe(404);
      const audit = await (
        await page.request.get(
          `/api/admin/audit?edition=${slug}&module=tournament`,
        )
      ).json();
      expect(
        audit.rows.every(
          (event: { actorId: number }) => event.actorId === adminId,
        ),
      ).toBe(true);
      expect(
        (await guest.request.get(`/api/players/${playerId}`)).status(),
      ).toBe(404);
      expect(
        (
          await guest.request.get(`/api/admin/registrations/${application.id}`)
        ).status(),
      ).toBe(404); // No public application-by-ID route.
    } finally {
      await guest.close();
      await player.close();
      await limited.close();
    }
  });
});
