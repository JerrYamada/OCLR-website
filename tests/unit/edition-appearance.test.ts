import { describe, expect, it } from "vitest";
import {
  editionAppearance,
  readEditionAppearance,
  readEditionAppearancePreview,
} from "../../src/lib/edition-appearance";
import { editionSchema } from "../../src/lib/editions";
import { edition } from "../fixtures/edition";

describe("edition appearance boundaries", () => {
  it("enables S11 and the approved S8 test edition without affecting other editions", () => {
    expect(editionAppearance("s11")).toBe("cute-pastel");
    expect(editionAppearance("s8")).toBe("cute-pastel");
    for (const slug of ["s10", "s11-archive", "other"])
      expect(editionAppearance(slug)).toBe("default");
    expect(editionAppearance("s11", "default")).toBe("default");
    expect(editionAppearance("s8", "default")).toBe("default");
    expect(editionAppearance("other", "cute-pastel")).toBe("cute-pastel");
  });
  it("keeps preview preferences inside one exact edition", () => {
    expect(readEditionAppearancePreview("s8:cute-pastel", "s8")).toBe(
      "cute-pastel",
    );
    expect(readEditionAppearancePreview("s8:default", "s8")).toBe("default");
    for (const value of [
      undefined,
      "s8-other:cute-pastel",
      "s11:cute-pastel",
      "s8:cute-pastel:extra",
    ])
      expect(readEditionAppearancePreview(value, "s8")).toBeUndefined();
  });
  it("accepts only known presets while preserving old branding records", () => {
    expect(editionSchema.safeParse(edition).success).toBe(true);
    expect(
      editionSchema.safeParse({
        ...edition,
        branding: { ...edition.branding, theme: "cute-pastel" },
      }).success,
    ).toBe(true);
    expect(
      editionSchema.safeParse({
        ...edition,
        branding: { ...edition.branding, theme: "external-css" },
      }).success,
    ).toBe(false);
    expect(readEditionAppearance("external-css")).toBeUndefined();
  });
});
