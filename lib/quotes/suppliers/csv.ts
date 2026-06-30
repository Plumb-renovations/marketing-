// Minimal, dependency-free delimited-text parser → a 2-D grid of strings.
// Handles quoted fields (with embedded commas, quotes and newlines), CRLF/LF,
// and auto-detects comma vs tab. Excel users export "Save As → CSV (UTF-8)".
// Supplier configs consume the raw grid; all sheet-specific shape lives there.
export function parseGrid(text: string): string[][] {
  // Strip a UTF-8 BOM if present.
  let s = text.replace(/^﻿/, "");
  // Auto-detect delimiter from the first line (tab vs comma).
  const firstLine = s.slice(0, s.indexOf("\n") === -1 ? s.length : s.indexOf("\n"));
  const delim = (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delim) { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // drop fully-empty trailing rows
  return rows.filter((r) => r.some((cell) => (cell ?? "").trim() !== "") || r.length > 1);
}
