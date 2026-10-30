import { describe, it, expect, vi, afterEach } from "vitest";
import { parseCandidateRows } from "../../src/lib/mappool-workbench-model";
import { permits, canRead } from "../../src/lib/auth/staff";
afterEach(() => vi.unstubAllEnvs());
describe("candidate selection input and role isolation", () => {
  it("retains original row numbers, rejects set-only URLs and deduplicates BID aliases", () => {
    expect(
      parseCandidateRows(
        "\n75\nhttps://osu.ppy.sh/beatmaps/75\n\nhttps://osu.ppy.sh/beatmapsets/1#osu/99\nhttps://osu.ppy.sh/beatmapsets/1\n101",
        [101],
      ).map((r) => [r.line, r.beatmapId, r.status]),
    ).toEqual([
      [2, 75, "ready"],
      [3, 75, "duplicate"],
      [5, 99, "ready"],
      [6, null, "invalid"],
      [7, 101, "duplicate"],
    ]);
    for (const value of [
      "",
      "\n",
      Array(51).fill("75").join("\n"),
      "1".repeat(16001),
    ])
      expect(() => parseCandidateRows(value)).toThrow();
    expect(parseCandidateRows(Array(50).fill("75").join("\n"))).toHaveLength(
      50,
    );
  });
  it("grants only candidate collaboration to testers/replayers, while Developer/remote cannot write", () => {
    for (const role of ["tester", "replayer", "mappooler"] as const) {
      const grants = [{ role, editionSlug: "test-cup" }];
      expect(permits(grants, "select_mappools", "test-cup")).toBe(true);
      expect(permits(grants, "select_mappools", "other-test-cup")).toBe(false);
      if (role !== "mappooler")
        expect(permits(grants, "manage_mappools", "test-cup")).toBe(false);
    }
    const developer = [{ role: "developer", editionSlug: null }] as const;
    expect(canRead(developer, "select_mappools", "test-cup")).toBe(true);
    expect(permits(developer, "select_mappools", "test-cup")).toBe(false);
    vi.stubEnv("OCLR_DATA_SOURCE", "remote");
    expect(
      permits(
        [{ role: "admin", editionSlug: null }],
        "select_mappools",
        "test-cup",
      ),
    ).toBe(false);
  });
});
