// Builds the Viet Nam tables the life engine reads (data/life/vnm/*.json) from public sources.
// Run: npm run life:data
// The first run downloads about 1.1 GB into .cache/life-data/; later runs reuse it.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { ISO3, WPP } from "./sources.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cacheDir = path.join(repoRoot, ".cache", "life-data");
const outDir = path.join(repoRoot, "data", "life", "vnm");

const FIRST_YEAR = 1950;
const LAST_YEAR = 2100;
const YEARS = LAST_YEAR - FIRST_YEAR + 1;
/** Single ages 0..99 get a yearly chance (qx); 100+ is an open group with a rate (mx). */
const OPEN_AGE = 100;
const FERTILE_FROM = 15;
const FERTILE_TO = 49;

/** Rounds to 4 significant digits so the JSON stays small and diffs stay stable. */
function round(value) {
  return value === 0 ? 0 : Number(value.toPrecision(4));
}

async function download(file) {
  const target = path.join(cacheDir, file);
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(cacheDir, { recursive: true });
  const url = WPP.base + file;
  console.log(`downloading ${file}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  const partial = `${target}.part`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial));
  fs.renameSync(partial, target);
  return target;
}

/** Splits one CSV line, honouring double-quoted fields (place names contain commas). */
function splitCsv(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/** Streams a gzipped WPP CSV and yields only Viet Nam rows as objects. */
async function* countryRows(file) {
  const input = fs.createReadStream(await download(file)).pipe(zlib.createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let header = null;
  for await (const line of lines) {
    if (!header) {
      header = splitCsv(line.replace(/^﻿/, ""));
      continue;
    }
    if (!line.includes(`,${ISO3},`)) continue;
    const cells = splitCsv(line);
    const row = Object.fromEntries(header.map((name, i) => [name, cells[i]]));
    if (row.ISO3_code !== ISO3) continue;
    if (row.Variant && row.Variant !== "Medium") continue;
    yield row;
  }
}

function yearIndex(row) {
  const year = Number(row.Time);
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR) {
    throw new Error(`unexpected year ${row.Time}`);
  }
  return year - FIRST_YEAR;
}

function assertComplete(name, rows, width) {
  rows.forEach((row, i) => {
    if (!row || row.length !== width || row.some((v) => v === undefined || v === null || Number.isNaN(v))) {
      throw new Error(`${name}: year ${FIRST_YEAR + i} is incomplete`);
    }
  });
  if (rows.length !== YEARS) throw new Error(`${name}: expected ${YEARS} years, got ${rows.length}`);
}

/** Period life expectancy at birth from single-age qx, the file's ax, and the open-group rate. */
function lifeExpectancy(qx, ax, m100) {
  let alive = 1;
  let years = 0;
  for (let age = 0; age < OPEN_AGE; age++) {
    const deaths = alive * qx[age];
    years += alive - deaths * (1 - ax[age]);
    alive -= deaths;
  }
  return years + alive / m100;
}

async function buildMortality() {
  const result = {};
  for (const [sex, files] of [
    ["female", WPP.files.lifeFemale],
    ["male", WPP.files.lifeMale],
  ]) {
    const qx = [];
    const ax = [];
    const m100 = [];
    const e0 = [];
    for (const file of files) {
      for await (const row of countryRows(file)) {
        const y = yearIndex(row);
        const age = Number(row.AgeGrpStart);
        qx[y] ??= new Array(OPEN_AGE).fill(null);
        ax[y] ??= new Array(OPEN_AGE).fill(null);
        if (age < OPEN_AGE) {
          if (qx[y][age] !== null) throw new Error(`duplicate ${sex} ${row.Time} age ${age}`);
          qx[y][age] = round(Number(row.qx));
          ax[y][age] = Number(row.ax);
        } else {
          m100[y] = round(Number(row.mx));
        }
        if (age === 0) e0[y] = Number(row.ex);
      }
    }
    assertComplete(`${sex} qx`, qx, OPEN_AGE);
    // Rounding must not move life expectancy: recompute it from what we store.
    for (let y = 0; y < YEARS; y++) {
      const drift = Math.abs(lifeExpectancy(qx[y], ax[y], m100[y]) - e0[y]);
      if (!(drift < 0.05)) {
        throw new Error(`${sex} ${FIRST_YEAR + y}: rounded qx moves e0 by ${drift.toFixed(3)} years`);
      }
    }
    result[sex] = { qx, m100 };
  }
  return {
    source: `${WPP.name}, complete life tables, medium variant (${WPP.licence})`,
    firstYear: FIRST_YEAR,
    lastYear: LAST_YEAR,
    openAge: OPEN_AGE,
    note: "qx[year - firstYear][age] is the chance of dying within the year at ages 0-99. Ages 100+ use the rate m100: yearly chance 1 - exp(-m100).",
    ...result,
  };
}

async function buildFertility() {
  const asfr = [];
  const width = FERTILE_TO - FERTILE_FROM + 1;
  for await (const row of countryRows(WPP.files.fertility)) {
    const y = yearIndex(row);
    const age = Number(row.AgeGrpStart);
    if (age < FERTILE_FROM || age > FERTILE_TO) continue;
    asfr[y] ??= new Array(width).fill(null);
    if (asfr[y][age - FERTILE_FROM] !== null) throw new Error(`duplicate ASFR ${row.Time} age ${age}`);
    // WPP gives births per 1,000 women; the engine wants a yearly chance per woman.
    asfr[y][age - FERTILE_FROM] = round(Number(row.ASFR) / 1000);
  }
  assertComplete("asfr", asfr, width);
  return {
    source: `${WPP.name}, fertility by single age, medium variant (${WPP.licence})`,
    firstYear: FIRST_YEAR,
    lastYear: LAST_YEAR,
    fromAge: FERTILE_FROM,
    toAge: FERTILE_TO,
    note: "asfr[year - firstYear][age - fromAge] is births per woman per year.",
    asfr,
  };
}

async function buildIndicators() {
  const columns = {
    srb: "SRB",
    tfr: "TFR",
    lexFemale: "LExFemale",
    lexMale: "LExMale",
    births: "Births",
    deaths: "Deaths",
  };
  const series = Object.fromEntries(Object.keys(columns).map((key) => [key, new Array(YEARS).fill(null)]));
  for await (const row of countryRows(WPP.files.indicators)) {
    // This file runs to 2101 (populations on 1 January); the engine stops at 2100.
    if (Number(row.Time) > LAST_YEAR) continue;
    const y = yearIndex(row);
    for (const [key, column] of Object.entries(columns)) {
      if (!(column in row)) throw new Error(`indicators: missing column ${column}`);
      series[key][y] = round(Number(row[column]));
    }
  }
  for (const [key, values] of Object.entries(series)) {
    if (values.some((v) => v === null || Number.isNaN(v))) throw new Error(`indicators: ${key} is incomplete`);
  }
  return {
    source: `${WPP.name}, demographic indicators, medium variant (${WPP.licence})`,
    firstYear: FIRST_YEAR,
    lastYear: LAST_YEAR,
    note: "srb = male births per 100 female births; births and deaths in thousands; lex* = period life expectancy at birth.",
    ...series,
  };
}

/** JSON with one array of numbers per line, so a data refresh produces a readable diff. */
function writeJson(name, value) {
  const text = JSON.stringify(value, null, 1).replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_, body) =>
    `[${body.replace(/\s+/g, "")}]`,
  );
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, name);
  fs.writeFileSync(file, `${text}\n`);
  console.log(`wrote ${path.relative(repoRoot, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

writeJson("mortality.json", await buildMortality());
writeJson("fertility.json", await buildFertility());
writeJson("indicators.json", await buildIndicators());
