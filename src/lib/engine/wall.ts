/**
 * Grouping key for free-text statements.
 *
 * Two people independently writing "made space for quieter people" are making
 * the same point, and the wall should show it once with their combined support
 * rather than twice competing with itself. Punctuation, casing and trailing
 * whitespace are all noise for that comparison.
 */
export function wallKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
