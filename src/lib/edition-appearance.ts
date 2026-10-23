export type EditionAppearance = "default" | "cute-pastel";
export const editionAppearancePreviewCookie = "oclr-edition-appearance-preview";
export const editionAppearancePreviewParam = "appearance-preview";

export function readEditionAppearance(value: string | null | undefined) {
  return value === "default" || value === "cute-pastel" ? value : undefined;
}

/** S11's art direction, also enabled on S8 for historical-data testing. */
export function editionAppearance(
  slug: string,
  configured?: EditionAppearance,
) {
  return (
    configured ?? (["s8", "s11"].includes(slug) ? "cute-pastel" : "default")
  );
}

/** A browser preview applies to one exact edition and never changes its data. */
export function readEditionAppearancePreview(
  value: string | undefined,
  slug: string,
) {
  if (!value?.startsWith(`${slug}:`)) return undefined;
  return readEditionAppearance(value.slice(slug.length + 1));
}
