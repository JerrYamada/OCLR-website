import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { BwsSummary } from "../../src/components/bws-summary";
import { summarizeBws } from "../../src/lib/bws-model";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
import messages from "../../messages/en.json";

function render(
  rank: number | null,
  pp: number | null,
  pending = false,
  variant: "detail" | "compact" = "detail",
) {
  const profile = normalizeOsuProfile(
    {
      id: 1,
      username: "Synthetic",
      badges: pending ? null : [],
      statistics: { global_rank: rank, pp },
    },
    1,
    "osu",
    "2026-10-24T00:00:00Z",
  );
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <BwsSummary
        variant={variant}
        value={summarizeBws({ profile, stale: true, notice: null }, null)}
      />
    </NextIntlClientProvider>,
  );
}
describe("shared public and staff BWS display", () => {
  it("shows pp without rank and retains the stale warning", () => {
    const html = render(null, 1234.567);
    expect(html).toContain("Unranked / unavailable");
    expect(html).toContain("1,234.57");
    expect(html).toContain("BW-PP");
    expect(html).toContain("pp^(1.0063^(badges^2)/1)");
    expect(html).toContain("Stale snapshot");
  });
  it("shows rank without pp and never fabricates a zero", () => {
    const html = render(10000, null);
    expect(html).toContain("10,000");
    expect(html).toContain("Weighted pp unavailable");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("shows the plain rank and pp while badges await review", () => {
    expect(render(null, 0)).toContain('class="bws-value">0</strong>');
    const html = render(10000, 1234.567, true, "compact");
    expect(html).toContain("Global rank");
    expect(html).toContain("#10,000");
    expect(html).toContain("pp");
    expect(html).toContain("1,234.57");
    expect(html).not.toContain("BW-rank");
    expect(html).not.toContain("BW-PP");
    expect(html).toContain("Badge eligibility pending staff review");
  });
});
