/**
 * ES: Utilidades de listas y sangría para Live Preview: nivel de anidación y desindentado de bloques.
 * EN: List and indentation utilities for Live Preview: nesting level and block dedenting.
 */

/** ES: Sangría visual (em) por nivel de lista. EN: Visual indentation (em) per list level. */
export const LIST_INDENT_EM = 1.4;

/**
 * ES: Nivel de anidación a partir del espacio en blanco inicial (2 espacios o 1 tab = 1 nivel).
 * EN: Nesting level from the leading whitespace (2 spaces or 1 tab = 1 level).
 */
export function listDepth(leading: string): number {
  const columns = leading.replace(/\t/g, "  ").length;
  return Math.floor(columns / 2);
}

/**
 * ES: Elimina la sangría común de un bloque para que el pipeline lo interprete como Markdown y no como código indentado.
 * EN: Removes the common indentation of a block so the pipeline parses it as Markdown rather than indented code.
 */
export function dedentBlock(raw: string): { text: string; columns: number } {
  const lines = raw.split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => (l.match(/^[ \t]*/)?.[0].replace(/\t/g, "  ").length ?? 0));
  const columns = indents.length ? Math.min(...indents) : 0;
  if (columns === 0) return { text: raw, columns: 0 };
  return { text: lines.map((l) => l.replace(new RegExp(`^[ \\t]{0,${columns}}`), "")).join("\n"), columns };
}
