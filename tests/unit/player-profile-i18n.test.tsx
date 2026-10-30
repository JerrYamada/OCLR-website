import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerProfile } from "../../src/components/player-profile";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
import { appTranslator } from "../../src/i18n/translate";
import { profileResponse } from "../fixtures/osu-profile";
import en from "../../messages/en.json";
import hans from "../../messages/zh-Hans.json";
import hant from "../../messages/zh-Hant.json";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

for (const [locale, messages, unavailable, seconds] of [
  ["en", en, "Unavailable", "4h 46m 56s"],
  ["zh-Hans", hans, "暂不可用", "4时 46分 56秒"],
  ["zh-Hant", hant, "暫不可用", "4時 46分 56秒"],
] as const) {
  describe(`profile statistics in ${locale}`, () => {
    const native = createTranslator({ locale, messages: messages.ui });
    const tr = appTranslator(
      (key, values) => native(key as keyof typeof messages.ui, values),
      locale,
    );
    const mode = "osu";
    for (const kind of ["normal", "zero", "null"] as const)
      it(`renders ${kind} statistics for ${mode}`, () => {
        const profile = normalizeOsuProfile(
          {
            ...profileResponse,
            cover: null,
            statistics:
              kind === "null"
                ? null
                : kind === "zero"
                  ? {
                      global_rank: 0,
                      country_rank: 0,
                      pp: 0,
                      hit_accuracy: 0,
                      play_count: 0,
                      play_time: 0,
                      ranked_score: "0",
                      total_score: "0",
                      maximum_combo: 0,
                      level: { current: 0, progress: 0 },
                    }
                  : { ...profileResponse.statistics, play_time: 17216 },
          },
          profileResponse.id,
          mode,
        );
        const html = renderToStaticMarkup(
          <NextIntlClientProvider
            locale={locale}
            messages={messages}
            timeZone="UTC"
          >
            <PlayerProfile snapshot={{ profile, stale: false, notice: null }} />
          </NextIntlClientProvider>,
        );
        const rows = [...html.matchAll(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g)];
        const value = (label: string) =>
          rows.find((row) => row[1] === tr(label))?.[2];
        // Global rank, country rank and pp live in the BWS card, not this list.
        for (const label of ["Global rank", "Country rank", "Performance"])
          expect(value(label)).toBeUndefined();
        if (kind === "null") {
          for (const label of [
            "Accuracy",
            "Play count",
            "Play time",
            "Ranked score",
            "Total score",
            "Maximum combo",
            "Level",
          ])
            expect(value(label)).toBe(unavailable);
        } else if (kind === "zero") {
          expect(value("Accuracy")).toBe("0%");
          expect(value("Play count")).toBe("0");
          expect(value("Play time")).toBe(locale === "en" ? "0s" : "0秒");
          expect(value("Ranked score")).toBe("0");
          expect(value("Total score")).toBe("0");
          expect(value("Maximum combo")).toBe("0×");
          expect(value("Level")).toBe("0 (0%)");
        } else {
          expect(value("Play time")).toBe(seconds);
          expect(value("Ranked score")).toBe("9,007,199,254,740,993");
        }
      });
  });
}
