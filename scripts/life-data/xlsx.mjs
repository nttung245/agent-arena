// A minimal .xlsx reader built on Node's zlib, so the data build needs no extra packages.
// It reads cell values only (no formulas, styles or dates): enough for UN and World Bank tables.
import fs from "node:fs";
import zlib from "node:zlib";

/** Lists a zip's entries and returns a function that inflates one by name. */
function openZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("bad zip central directory");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    const local = entry.localOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`bad zip entry ${name}`);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return data.toString("utf8");
    if (entry.method === 8) return zlib.inflateRawSync(data).toString("utf8");
    throw new Error(`unsupported zip compression ${entry.method} for ${name}`);
  };
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** Joins every <t> inside a shared string or inline string (rich text has several). */
function textOf(xml) {
  return decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
}

function columnIndex(ref) {
  let index = 0;
  for (const ch of ref.replace(/\d+$/, "")) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * Reads one sheet as an array of rows; each row is an array of cell values
 * (number, string, or null for blanks), indexed by column.
 */
export function readSheet(file, sheetName) {
  const read = openZip(fs.readFileSync(file));
  const workbook = read("xl/workbook.xml");
  const rels = read("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error(`${file}: not an xlsx workbook`);

  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: decodeXml(/name="([^"]*)"/.exec(m[0])?.[1] ?? ""),
    rid: /r:id="([^"]*)"/.exec(m[0])?.[1],
  }));
  const sheet = sheets.find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`${file}: no sheet "${sheetName}" (has: ${sheets.map((s) => s.name).join(", ")})`);
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => tag.includes(`Id="${sheet.rid}"`));
  const target = /Target="([^"]*)"/.exec(rel ?? "")?.[1];
  if (!target) throw new Error(`${file}: sheet "${sheetName}" has no target`);
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;

  const sharedXml = read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];

  const xml = read(path);
  if (!xml) throw new Error(`${file}: missing ${path}`);
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1]);
    const cells = [];
    for (const cell of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const type = /\bt="([^"]*)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = null;
      if (type === "s" && raw !== undefined) value = shared[Number(raw)] ?? null;
      else if (type === "inlineStr") value = textOf(body);
      else if (type === "str" && raw !== undefined) value = decodeXml(raw);
      else if (type === "b" && raw !== undefined) value = raw === "1";
      else if (raw !== undefined) value = Number(raw);
      cells[columnIndex(ref)] = value;
    }
    rows[rowNumber - 1] = Array.from(cells, (v) => (v === undefined ? null : v));
  }
  return Array.from(rows, (row) => row ?? []);
}

/** Finds the first row whose cells include every label, for tables with notes above the header. */
export function findHeaderRow(rows, labels) {
  const index = rows.findIndex((row) => labels.every((label) => row.some((cell) => cell === label)));
  if (index < 0) throw new Error(`no header row with ${labels.join(", ")}`);
  return index;
}
