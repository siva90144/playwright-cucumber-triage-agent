type Col = { key: string; label: string; width: number };

function padRight(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

function ellipsize(s: string, width: number): string {
  if (s.length <= width) return s;
  if (width <= 1) return "…";
  return s.slice(0, width - 1) + "…";
}

export function renderTable(rows: Array<Record<string, string>>, cols: Col[]): string {
  const top = "┌" + cols.map(c => "─".repeat(c.width + 2)).join("┬") + "┐";
  const mid = "├" + cols.map(c => "─".repeat(c.width + 2)).join("┼") + "┤";
  const bot = "└" + cols.map(c => "─".repeat(c.width + 2)).join("┴") + "┘";

  const header =
    "│" +
    cols.map(c => " " + padRight(ellipsize(c.label, c.width), c.width) + " ").join("│") +
    "│";

  const body = rows.map(r => (
    "│" +
    cols.map(c => {
      const v = String(r[c.key] ?? "");
      return " " + padRight(ellipsize(v, c.width), c.width) + " ";
    }).join("│") +
    "│"
  ));

  return [top, header, mid, ...(body.length ? body : [header.replace(/[^│]/g, " ")]), bot].join("\n");
}
