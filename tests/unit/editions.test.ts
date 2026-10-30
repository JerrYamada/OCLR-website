import { describe, expect, it } from "vitest";
import {
  editionSchema,
  editionsSchema,
  enrollmentState,
  formatDate,
  registrationBlockers,
  suggestEditionSlug,
  publicEditionSummary,
} from "../../src/lib/editions";
import { edition } from "../fixtures/edition";
describe("edition configuration", () => {
  it("normalizes ICU date spacing consistently between server and browser", () => {
    const formatter = Object.getOwnPropertyDescriptor(
      Intl.DateTimeFormat.prototype,
      "format",
    )!;
    try {
      for (const space of [" ", "\u2009", "\u00a0", "\u202f"]) {
        Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
          configurable: true,
          get: () => () => `2026/10/23${space}11:45`,
        });
        expect(
          formatDate("2026-10-23T03:45:00Z", "Asia/Taipei", "zh-Hans"),
        ).toBe("2026/10/23 11:45 (UTC+8)");
      }
    } finally {
      Object.defineProperty(Intl.DateTimeFormat.prototype, "format", formatter);
    }
  });
  it("omits only known bootstrap copy without hiding approved custom summaries", () => {
    expect(
      publicEditionSummary(
        "osu! Chinese League Rookie — Season 11. Tournament information is awaiting organizer approval.",
      ),
    ).toBeNull();
    expect(
      publicEditionSummary(
        "  Tournament information is awaiting organizer approval.  ",
      ),
    ).toBeNull();
    expect(publicEditionSummary("Approved local event details.")).toBe(
      "Approved local event details.",
    );
    expect(
      publicEditionSummary(
        "Eligibility is awaiting organizer approval; registration is open.",
      ),
    ).not.toBeNull();
    expect(publicEditionSummary("")).toBeNull();
  });
  it("suggests a valid editable slug without inventing tournament content", () => {
    expect(suggestEditionSlug("OCLR Season 12")).toBe("oclr-season-12");
    expect(suggestEditionSlug("  Édition / 12! ")).toBe("edition-12");
    expect(suggestEditionSlug("New")).toBe("new-tournament");
    expect(suggestEditionSlug("中文")).toBe("");
    expect(suggestEditionSlug("a".repeat(100))).toHaveLength(80);
    expect(suggestEditionSlug("a ".repeat(60))).not.toMatch(/-$/);
  });
  it("allows blank private copy but requires an approved summary to publish", () => {
    expect(
      editionSchema.safeParse({ ...edition, published: false, summary: "" })
        .success,
    ).toBe(true);
    expect(editionSchema.safeParse({ ...edition, summary: " " }).success).toBe(
      false,
    );
  });
  it("validates real content while preventing duplicate editions, invalid dates and timezones", () => {
    expect(editionSchema.safeParse(edition).success).toBe(true);
    expect(editionsSchema.safeParse([edition, edition]).success).toBe(false);
    expect(
      editionSchema.safeParse({ ...edition, timeZone: "invalid" }).success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({ ...edition, timeZone: "+08:00" }).success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({ ...edition, timeZone: "Etc/GMT+8" }).success,
    ).toBe(true);
    expect(
      editionSchema.safeParse({
        ...edition,
        registration: {
          ...edition.registration,
          closesAt: "2020-01-01T00:00:00Z",
        },
      }).success,
    ).toBe(false);
  });
  it("requires publication and a window before opening; closes at exact boundary", () => {
    expect(enrollmentState({ ...edition, published: false })).toBe(
      "unannounced",
    );
    expect(enrollmentState({ ...edition, rules: null })).toBe("open");
    expect(enrollmentState({ ...edition, eligibility: null })).toBe("open");
    expect(enrollmentState(edition, new Date("2024-12-31T23:59:59Z"))).toBe(
      "upcoming",
    );
    expect(enrollmentState(edition, new Date("2025-01-01T00:00:00Z"))).toBe(
      "open",
    );
    expect(enrollmentState(edition, new Date("2099-01-01T00:00:00Z"))).toBe(
      "closed",
    );
  });
  it("distinguishes paused registration from missing configuration and completed editions", () => {
    expect(
      enrollmentState(
        {
          ...edition,
          registration: { ...edition.registration!, enabled: false },
        },
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toBe("paused");
    expect(
      enrollmentState({
        ...edition,
        status: "completed",
        registration: { ...edition.registration!, enabled: false },
      }),
    ).toBe("closed");
    expect(enrollmentState({ ...edition, registration: null })).toBe(
      "unannounced",
    );
  });
  it("reports only the prerequisites actually missing from registration setup", () => {
    expect(registrationBlockers(edition, true)).toEqual([]);
    expect(
      registrationBlockers({ ...edition, eligibility: null }, true),
    ).toEqual([]);
    expect(
      registrationBlockers(
        { ...edition, published: false, status: "completed" },
        false,
      ),
    ).toEqual([
      "Publish the tournament before enabling registration.",
      "Complete the server privacy configuration.",
      "Completed tournaments cannot accept registrations.",
    ]);
  });
  it("shows an explicit configured timezone and TBA", () => {
    expect(formatDate(null, "Asia/Taipei")).toBe("To be announced");
    expect(formatDate("2026-01-01T00:00:00Z", "Asia/Taipei")).toContain(
      "08:00 (UTC+8)",
    );
  });
  it.each([
    ["Asia/Hong_Kong", "2026-01-01T00:00:00Z", "UTC+8"],
    ["Etc/GMT-8", "2026-01-01T00:00:00Z", "UTC+8"],
    ["Asia/Kolkata", "2026-01-01T00:00:00Z", "UTC+5:30"],
    ["Asia/Kathmandu", "2026-01-01T00:00:00Z", "UTC+5:45"],
    ["America/New_York", "2026-01-01T00:00:00Z", "UTC-5"],
    ["America/New_York", "2026-07-01T00:00:00Z", "UTC-4"],
    ["UTC", "2026-01-01T00:00:00Z", "UTC"],
  ])("shows the instant's offset for %s at %s", (zone, instant, offset) => {
    for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
      expect(formatDate(instant, zone, locale)).toContain(`(${offset})`);
      if (zone.includes("/"))
        expect(formatDate(instant, zone, locale)).not.toContain(zone);
    }
  });
});

import { coachingEnabled } from "../../src/lib/editions";
it("defaults S11 coaching off, retains legacy editions and respects explicit settings", () => {
  expect(coachingEnabled({ slug: "s11" })).toBe(false);
  expect(coachingEnabled({ slug: "s10" })).toBe(true);
  expect(coachingEnabled({ slug: "s11", coachesEnabled: true })).toBe(true);
  expect(coachingEnabled({ slug: "s10", coachesEnabled: false })).toBe(false);
});
