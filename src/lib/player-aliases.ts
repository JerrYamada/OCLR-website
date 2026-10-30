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

/** Long alias lists collapse behind a disclosure instead of stretching the name row. */
export function collapseAliases(names: readonly string[]): boolean {
  return names.length > 2 || names.join(", ").length > 28;
}
