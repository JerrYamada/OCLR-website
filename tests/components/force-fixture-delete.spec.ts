import { test, expect } from "@playwright/test";
import en from "../../messages/en.json" with { type: "json" };
import hans from "../../messages/zh-Hans.json" with { type: "json" };
import hant from "../../messages/zh-Hant.json" with { type: "json" };
const path = "**/api/admin/tournaments/synthetic/matches";
const preview = {
  fixtureId: "00000000-0000-4000-8000-000000000001",
  label: "Synthetic test fixture",
  version: 2,
  assignmentRevision: 3,
  fingerprint: "a".repeat(64),
  blocker: null,
  counts: {
    imports: 1,
    games: 3,
    results: 1,
    resultRevisions: 1,
    refereeSessions: 1,
    refereeEvents: 5,
    reconciliations: 1,
    connections: 1,
    commands: 2,
    referees: 2,
    streams: 1,
    statistics: 0,
  },
};
async function acknowledge(page: import("@playwright/test").Page) {
  await page
    .getByLabel("Type the fixture label to confirm", { exact: true })
    .fill(preview.label);
  await page
    .getByLabel(
      "I confirm this is test data and agree to remove its unapproved records.",
      { exact: true },
    )
    .check();
}
test("requires a current preview, exact label and test-data acknowledgement", async ({
  page,
}) => {
  const writes: Record<string, unknown>[] = [];
  await page.route(path, async (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    await route.fulfill({
      json: body.action === "preview_force_delete" ? preview : {},
    });
  });
  await page.goto("/force-fixture-delete");
  await page
    .getByRole("button", { name: "Force delete test fixture", exact: true })
    .click();
  const confirm = page.getByRole("button", {
    name: "Confirm force deletion",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  expect(writes).toHaveLength(1);
  await page
    .getByLabel("Type the fixture label to confirm", { exact: true })
    .fill("Wrong fixture");
  await page
    .getByLabel(
      "I confirm this is test data and agree to remove its unapproved records.",
      { exact: true },
    )
    .check();
  await expect(confirm).toBeDisabled();
  await acknowledge(page);
  await confirm.click();
  await expect(page.getByRole("status")).toHaveText(
    "Deleted synthetic fixture",
  );
  expect(writes[1]).toEqual({
    action: "force_delete",
    fixtureId: preview.fixtureId,
    expectedVersion: 2,
    expectedAssignmentRevision: 3,
    expectedDeletionFingerprint: preview.fingerprint,
    confirmationLabel: preview.label,
    testFixtureConfirmed: true,
    confirmed: true,
  });
});
test("retains official history and read-only boundaries", async ({ page }) => {
  let requests = 0;
  await page.route(path, async (route) => {
    requests++;
    await route.fulfill({ json: { ...preview, blocker: "official_result" } });
  });
  await page.goto("/force-fixture-delete?readonly");
  await expect(
    page.getByRole("button", {
      name: "Force delete test fixture",
      exact: true,
    }),
  ).toBeDisabled();
  expect(requests).toBe(0);
  await page.goto("/force-fixture-delete");
  await page
    .getByRole("button", { name: "Force delete test fixture", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Approved or published result history cannot be force deleted.",
  );
  await expect(
    page.getByRole("button", { name: "Confirm force deletion", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(requests).toBe(1);
});
test("invalidates a stale confirmation and requires a fresh acknowledgement", async ({
  page,
}) => {
  const writes: Record<string, unknown>[] = [];
  let previews = 0;
  await page.route(path, async (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    if (body.action === "preview_force_delete") {
      previews++;
      await route.fulfill({
        json: {
          ...preview,
          fingerprint: (previews === 1 ? "a" : "b").repeat(64),
        },
      });
    } else
      await route.fulfill({
        status: 409,
        json: {
          error:
            "Fixture records changed. Reload the deletion preview before confirming.",
        },
      });
  });
  await page.goto("/force-fixture-delete");
  await page
    .getByRole("button", { name: "Force delete test fixture", exact: true })
    .click();
  await acknowledge(page);
  await page
    .getByRole("button", { name: "Confirm force deletion", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Fixture records changed",
  );
  await expect(
    page.getByRole("button", { name: "Confirm force deletion", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reload deletion preview", exact: true })
    .click();
  await expect(
    page.getByLabel("Type the fixture label to confirm", { exact: true }),
  ).toHaveValue("");
  await acknowledge(page);
  await page
    .getByRole("button", { name: "Confirm force deletion", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(4);
  expect(writes[3].expectedDeletionFingerprint).toBe("b".repeat(64));
});
test("allows a lost-response retry with the same snapshot", async ({
  page,
}) => {
  const deletes: Record<string, unknown>[] = [];
  await page.route(path, async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "preview_force_delete")
      await route.fulfill({ json: preview });
    else {
      deletes.push(body);
      if (deletes.length === 1) await route.abort();
      else await route.fulfill({ json: {} });
    }
  });
  await page.goto("/force-fixture-delete");
  await page
    .getByRole("button", { name: "Force delete test fixture", exact: true })
    .click();
  await acknowledge(page);
  await page
    .getByRole("button", { name: "Confirm force deletion", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Connection interrupted");
  await page
    .getByRole("button", { name: "Confirm force deletion", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Deleted synthetic fixture",
  );
  expect(deletes[1]).toEqual(deletes[0]);
});
for (const [locale, catalog] of [
  ["en", en],
  ["zh-Hans", hans],
  ["zh-Hant", hant],
] as const) {
  test(`renders ${locale} deletion scope at mobile widths in both themes`, async ({
    page,
    isMobile,
  }, testInfo) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
    await page.route(path, (route) => route.fulfill({ json: preview }));
    const key = Object.entries(en.ui).find(
      ([, text]) => text === "Force delete test fixture",
    )![0] as keyof typeof en.ui;
    for (const theme of ["light", "dark"]) {
      await page.goto(`/force-fixture-delete?locale=${locale}&theme=${theme}`);
      await page
        .getByRole("button", { name: catalog.ui[key], exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: catalog.ui[key], exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (theme === "dark")
        await page.screenshot({
          path: testInfo.outputPath(`${locale}-delete.png`),
        });
    }
  });
}
