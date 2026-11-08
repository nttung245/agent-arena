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
import { ISO3, MARRIAGE, MIGRANTS, UIS, WDI, WPP } from "./sources.mjs";
import { findHeaderRow, readSheet } from "./xlsx.mjs";

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

async function download(file, url = WPP.base + file) {
  const target = path.join(cacheDir, file);
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(cacheDir, { recursive: true });
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
    population: "TPopulation1July",
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
    note: "srb = male births per 100 female births; births, deaths and population (1 July) in thousands; lex* = period life expectancy at birth.",
    ...series,
  };
}

/** Crisis kinds the engine can name as a cause, mapped from WPP's event types. */
function crisisKind(eventType) {
  if (eventType === "Conflict" || eventType === "Battle deaths") return "conflict";
  if (eventType.startsWith("Natural Disaster")) return "disaster";
  if (eventType === "Epidemic") return "epidemic";
  if (eventType === "COVID-19") return "covid";
  throw new Error(`crises: unknown event type "${eventType}"`);
}

/**
 * Yearly share of all deaths from each crisis kind. WPP already includes these
 * deaths in its life tables, so the engine treats them as causes inside
 * all-cause mortality, never as an extra hazard.
 */
async function buildCrises(indicators) {
  const file = await download(WPP.crises.file, WPP.crises.url);
  const rows = readSheet(file, WPP.crises.sheet);
  const headerIndex = findHeaderRow(rows, ["ISO3_Code", "Year", "EventType", "Deaths"]);
  const header = rows[headerIndex];
  const col = (name) => header.indexOf(name);
  const deathsByYear = {};
  for (const row of rows.slice(headerIndex + 1)) {
    if (row[col("ISO3_Code")] !== ISO3) continue;
    const year = Number(row[col("Year")]);
    const kind = crisisKind(String(row[col("EventType")]));
    const deaths = Number(row[col("Deaths")]);
    if (!Number.isFinite(deaths) || deaths <= 0) continue;
    (deathsByYear[year] ??= {})[kind] = (deathsByYear[year][kind] ?? 0) + deaths;
  }
  const years = {};
  for (const year of Object.keys(deathsByYear).map(Number).sort((a, b) => a - b)) {
    const total = indicators.deaths[year - FIRST_YEAR] * 1000;
    const entry = {};
    for (const [kind, deaths] of Object.entries(deathsByYear[year]).sort()) {
      const share = deaths / total;
      if (!(share < 0.5)) throw new Error(`crises: ${kind} in ${year} is ${share} of all deaths`);
      entry[kind] = { deaths: Math.round(deaths), share: round(share) };
    }
    years[year] = entry;
  }
  return {
    source: `${WPP.name}, metadata for mortality crises (${WPP.licence})`,
    note: "years[y][kind].share = crisis deaths / all deaths that year. These deaths are already inside mortality.json. 'conflict' adds WPP's Conflict and Battle deaths event types.",
    years,
  };
}

/** Age bands the cause-of-death model works in; each value is the band's first age. */
const DEATH_BANDS = [0, 1, 5, 15, 30, 45, 60, 75];
const DEATHS_LAST_YEAR = 2023;

/** WPP deaths by age band and sex (thousands), to weight cause shares by who actually dies. */
async function buildDeaths() {
  const span = DEATHS_LAST_YEAR - FIRST_YEAR + 1;
  const result = {};
  for (const sex of ["female", "male"]) result[sex] = Array.from({ length: span }, () => new Array(DEATH_BANDS.length).fill(0));
  for await (const row of countryRows(WPP.files.deaths)) {
    const y = yearIndex(row);
    const age = Number(row.AgeGrpStart);
    let band = 0;
    while (band + 1 < DEATH_BANDS.length && age >= DEATH_BANDS[band + 1]) band++;
    result.female[y][band] += Number(row.DeathFemale);
    result.male[y][band] += Number(row.DeathMale);
  }
  for (const sex of ["female", "male"]) {
    result[sex] = result[sex].map((bands, i) => {
      if (bands.every((v) => v === 0)) throw new Error(`deaths: ${sex} ${FIRST_YEAR + i} is empty`);
      return bands.map(round);
    });
  }
  return {
    source: `${WPP.name}, deaths by single age and sex, medium variant (${WPP.licence})`,
    firstYear: FIRST_YEAR,
    lastYear: DEATHS_LAST_YEAR,
    bands: DEATH_BANDS,
    note: "female/male[year - firstYear][band] = deaths in thousands; bands start at the listed ages, the last is open.",
    ...result,
  };
}

async function buildCauses() {
  return {
    source: `${WDI.publisher}, ${WDI.name} (${WDI.licence}), derived from WHO Global Health Estimates`,
    note: "Percent of all deaths by cause group, as published: SH.DTH.COMM.ZS communicable, maternal, perinatal and nutritional conditions; SH.DTH.NCOM.ZS non-communicable diseases; SH.DTH.INJR.ZS injuries. SH.STA.TRAF.P5: road-traffic deaths per 100,000 people. Crisis deaths (crises.json) are inside these groups.",
    wdi: await wdiTable(WDI.causes),
  };
}

/** Fetches JSON once and keeps it in the cache, so rebuilds are repeatable and offline. */
async function cachedJson(name, url) {
  const target = path.join(cacheDir, "api", `${name}.json`);
  if (fs.existsSync(target)) return JSON.parse(fs.readFileSync(target, "utf8"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  console.log(`fetching ${name}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = await res.json();
  fs.writeFileSync(target, JSON.stringify(body));
  return body;
}

/** A WDI indicator as { year: value }, published values only, sorted by year. */
async function wdiSeries(code) {
  const body = await cachedJson(`wdi_${code}`, WDI.url(code));
  const points = Array.isArray(body) ? body[1] : null;
  if (!Array.isArray(points)) throw new Error(`WDI ${code}: unexpected response`);
  const series = {};
  for (const point of [...points].sort((a, b) => Number(a.date) - Number(b.date))) {
    if (point.value === null || point.value === undefined) continue;
    series[point.date] = round(Number(point.value));
  }
  if (Object.keys(series).length === 0) throw new Error(`WDI ${code}: no values for ${ISO3}`);
  return series;
}

async function wdiTable(codes) {
  const table = {};
  for (const code of codes) table[code] = await wdiSeries(code);
  return table;
}

async function buildSchool() {
  const body = await cachedJson("uis_completion", UIS.url(UIS.codes));
  const uis = Object.fromEntries(UIS.codes.map((code) => [code, {}]));
  for (const record of [...body.records].sort((a, b) => a.year - b.year)) {
    if (record.geoUnit !== ISO3 || !(record.indicatorId in uis) || record.value === null) continue;
    uis[record.indicatorId][record.year] = round(Number(record.value));
  }
  for (const [code, series] of Object.entries(uis)) {
    if (Object.keys(series).length === 0) delete uis[code];
  }
  if (!uis["CR.1"] || !uis["CR.2"] || !uis["CR.3"]) throw new Error("UIS: missing a total completion series");
  return {
    source: `${UIS.publisher}, ${UIS.name} (${UIS.licence}); ${WDI.publisher}, ${WDI.name} (${WDI.licence})`,
    licence: "This file is released under CC BY-SA 4.0 because it adapts UIS data.",
    note: "Values in percent, as published, by survey or reference year. UIS CR.n = share of people 3-5 years above the stage's graduation age who completed it (1 primary, 2 lower secondary, 3 upper secondary); .Q1-.Q5 income fifths (Q1 poorest), .URB/.RUR town/village, .F/.M sex. WDI completion rates are gross and can pass 100.",
    uis,
    wdi: await wdiTable(WDI.school),
  };
}

async function buildWork() {
  return {
    source: `${WDI.publisher}, ${WDI.name} (${WDI.licence})`,
    note: "Values as published, by year. SL.*.EMPL.ZS: employment by sector (% of employment; .FE/.MA by sex; ILO modelled estimates). NY.GDP.PCAP.PP.KD: GDP per capita, PPP, constant 2021 international $. SI.DST.*.20: income share held by each fifth (%). SI.POV.GINI: Gini index.",
    wdi: await wdiTable(WDI.work),
  };
}

function preferredSource(name) {
  const rank = MARRIAGE.preference.findIndex((pattern) => pattern.test(name));
  return rank < 0 ? MARRIAGE.preference.length : rank;
}

async function buildMarriage() {
  const rows = readSheet(await download(MARRIAGE.file, MARRIAGE.url), MARRIAGE.sheet);
  const headerIndex = findHeaderRow(rows, ["Country or area", "YearStart", "Sex", "AgeStart", "DataValue"]);
  const header = rows[headerIndex];
  const col = (name) => header.indexOf(name);
  // sex -> year -> source -> { ageStart: share }
  const found = { female: {}, male: {} };
  for (const row of rows.slice(headerIndex + 1)) {
    if (row[col("Country or area")] !== MARRIAGE.country) continue;
    const sex = row[col("Sex")] === "Women" ? "female" : row[col("Sex")] === "Men" ? "male" : null;
    if (!sex) continue;
    const ageStart = Number(row[col("AgeStart")]);
    const ageEnd = Number(row[col("AgeEnd")]);
    // Keep the 5-year groups from 15 to 59 and the open 60+ group; skip 10-14 and finer old-age splits.
    if (ageStart < 15 || (ageStart < 60 && ageEnd - ageStart !== 4) || (ageStart >= 60 && ageStart !== 60)) continue;
    const year = Number(row[col("YearStart")]);
    const source = String(row[col("DataCatalog ShortName")]);
    ((found[sex][year] ??= {})[source] ??= {})[ageStart] = round(Number(row[col("DataValue")]) / 100);
  }
  const everMarried = { female: {}, male: {} };
  const chosen = { female: {}, male: {} };
  for (const sex of ["female", "male"]) {
    for (const year of Object.keys(found[sex]).map(Number).sort((a, b) => a - b)) {
      const sources = Object.entries(found[sex][year])
        .filter(([, groups]) => Object.keys(groups).length >= 5)
        .sort(([a], [b]) => preferredSource(a) - preferredSource(b) || a.localeCompare(b));
      if (sources.length === 0) continue;
      const [source, groups] = sources[0];
      everMarried[sex][year] = groups;
      chosen[sex][year] = source;
    }
    if (Object.keys(everMarried[sex]).length === 0) throw new Error(`marriage: no ${sex} data`);
  }
  return {
    source: `${MARRIAGE.publisher}, ${MARRIAGE.name} (${MARRIAGE.licence})`,
    note: "everMarried[sex][year][ageGroupStart] = share ever married (5-year groups; 60 = 60+). One source per sex and year, preferring censuses, then the annual population change survey, then DHS, MICS and AIS; the source used is in sources.",
    everMarried,
    sources: chosen,
  };
}

async function buildMigration() {
  const rows = readSheet(await download(MIGRANTS.file, MIGRANTS.url), MIGRANTS.sheet);
  const headerIndex = findHeaderRow(rows, ["Location code of destination", "Location code of origin"]);
  const header = rows[headerIndex];
  const destCol = header.indexOf("Region, development group, country or area of destination");
  const destCodeCol = header.indexOf("Location code of destination");
  const originCodeCol = header.indexOf("Location code of origin");
  const firstYearCol = originCodeCol + 1; // both sexes, then males, then females
  const years = [];
  for (let c = firstYearCol; typeof header[c] === "number" && !years.includes(header[c]); c++) years.push(header[c]);
  const stock = {};
  for (const row of rows.slice(headerIndex + 1)) {
    if (row[originCodeCol] !== MIGRANTS.originCode) continue;
    if (!(Number(row[destCodeCol]) < 900)) continue; // 900+ are world and regional totals
    const counts = years.map((_, i) => Number(row[firstYearCol + i]) || 0);
    stock[String(row[destCol]).replace(/\*$/, "").trim()] = counts;
  }
  const destinations = {};
  const other = years.map(() => 0);
  const last = years.length - 1;
  for (const [name, counts] of Object.entries(stock).sort(([, a], [, b]) => b[last] - a[last])) {
    if (counts[last] >= MIGRANTS.minStock) destinations[name] = counts;
    else counts.forEach((n, i) => (other[i] += n));
  }
  destinations.Other = other;
  return {
    source: `${MIGRANTS.publisher}, ${MIGRANTS.name} (${MIGRANTS.licence}); ${WDI.publisher}, ${WDI.name} (${WDI.licence})`,
    note: "emigrantStock: people born in Viet Nam living in each destination at mid-year (both sexes). These are stocks, not flows. urbanShare: % of Viet Nam's population living in towns and cities (WDI SP.URB.TOTL.IN.ZS).",
    emigrantStock: { years, destinations },
    urbanShare: await wdiSeries(WDI.migration[0]),
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
const indicators = await buildIndicators();
writeJson("indicators.json", indicators);
writeJson("crises.json", await buildCrises(indicators));
writeJson("deaths.json", await buildDeaths());
writeJson("causes.json", await buildCauses());
writeJson("school.json", await buildSchool());
writeJson("work.json", await buildWork());
writeJson("marriage.json", await buildMarriage());
writeJson("migration.json", await buildMigration());
