import { test, expect } from "@playwright/test";
import { seedSession } from "./session";
import { closeDb } from "../../src/db";
test.describe("Admin backup boundary and confirmation", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("global Admin sees private backup controls", async ({
    page,
    context,
    isMobile,
  }) => {
    await context.addCookies([await seedSession(isMobile ? 70001 : 60001)]);
    await page.route("**/api/admin/backups", (route) =>
      route.fulfill({
        json: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            action: "import",
            state: "validated",
            createdAt: "2026-10-30T00:00:00Z",
            manifest: {
              source: "Synthetic test",
              createdAt: "2026-10-30T00:00:00Z",
              release: "a".repeat(40),
            },
          },
        ],
      }),
    );
    await page.goto("/admin/backups");
    await expect(
      page.getByRole("heading", { name: "Database backups" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review restore" }).click();
    await expect(
      page.getByRole("button", { name: "Confirm restore", exact: true }),
    ).toBeDisabled();
    await page.getByRole("textbox", { name: "REPLACE" }).fill("REPLACE");
    await expect(
      page.getByRole("button", { name: "Confirm restore", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await context.addCookies([
      { name: "oclr-theme", value: "dark", domain: "127.0.0.1", path: "/" },
    ]);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Database backups" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review restore" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("backup-controls.png"),
      fullPage: true,
    });
  });
  test("direct requests reject ordinary users", async ({ context }) => {
    await context.addCookies([await seedSession(999002)]);
    expect((await context.request.get("/api/admin/backups")).status()).toBe(
      403,
    );
    expect(
      (
        await context.request.post("/api/admin/backups?action=backup", {
          headers: { origin: "http://127.0.0.1:3100" },
        })
      ).status(),
    ).toBe(403);
  });
});
