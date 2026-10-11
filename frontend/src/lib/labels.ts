/** Display controlled UI labels without changing stored values or acronyms. */
export function titleLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(
      /(^|[\s(/-])([a-z])/g,
      (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
    );
}
