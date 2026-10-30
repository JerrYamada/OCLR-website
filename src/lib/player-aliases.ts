/** Merges osu! profile aliases with roster names, dropping the current name. */
export function previousUsernames(
  provided: readonly string[],
  roster: readonly string[],
  current: string,
): string[] {
  const currentKey = current.toLowerCase();
  return [...new Set([...provided, ...roster])].filter(
    (name) => name.toLowerCase() !== currentKey,
  );
}

/**
 * Only genuinely long alias lists collapse behind a hover/focus panel; up to five
 * names stay inline so the row still reads at a glance.
 */
export function collapseAliases(names: readonly string[]): boolean {
  return names.length > 5;
}
