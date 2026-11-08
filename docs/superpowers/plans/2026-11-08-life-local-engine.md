# Life in Vietnam — Local Life Engine Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1in8b Engine with our own life engine. It runs in the browser, with no key, no quota and no network. A seed replays the same life. It is built only from public datasets and our own text.

**Why:** The 1in8b free plan allows 2,000 units a month. Our game spends one unit per engine step, including every minor decision it auto-answers (`resolveMinorDecisions` in `runLife.ts`). The 1in8b terms forbid rebuilding their engine from its answers, so this engine is a clean-room build: see "Clean-room rules".

**Architecture:** A pure TypeScript microsimulation in `src/game/sim/`. It lives one person a year at a time. Every roll draws against public rates for Vietnam, that calendar year, that age and sex, and the person's situation. It plugs into the game through the existing `LifeTransport` interface (`start`/`step`), so `runLife.ts`, the scene director and the UI keep working. The life's whole state travels in the run's `token` string, as it does today. The data comes from a build script that writes compact JSON into `data/life/vnm/`.

**Spec:** `docs/superpowers/specs/2026-11-03-life-in-vietnam-design.md`. This plan replaces its §5.1 (the 1in8b Engine), §5.2 (API terms) and §6.4 (engine client). Everything else in the spec still holds.

---

## Decisions (defaults; change them before Task 1 if you disagree)

| Decision | Default | Alternative |
|---|---|---|
| 1in8b | Removed. The local engine is the only engine. | Keep 1in8b as an optional engine (two sets of decision text to maintain). |
| Birth years | 1950–2025, matching where the UN data starts. Lives run past 2025 on the UN's medium-variant projections. | Births before 1950 need other sources; not planned. |
| Birth in the future | Follow-up. | — |
| Where the engine runs | In the browser, inside the lazy-loaded life chunk. | A server (none exists; the app is client-only). |
| Data | Built by `npm run life:data`. Compact JSON is committed; raw downloads are not. | Fetch at runtime (needs the network, and CORS). |
| Text | English first, our own words. | Vietnamese locale is a follow-up. |
| Region | New birth condition: North, Central or South. Before 1975 it decides which side of the war a life grows up on. | National only (loses most of the war-era history). |
| Faith | Kept, drawn from census shares. It changes ceremony scenes and text, not the odds. | — |
| Disability | Hidden in v1 (no rates yet). | — |
| Emigrants | Keep living on Vietnam's rates, with the destination recorded. A known limit. | Destination-country tables (follow-up). |

### Licence questions to settle first

1. **Causes of death (blocks Task 3).** WHO's dataset terms allow use "for public health purposes" only, and any change beyond minimal reformatting "(including abbreviations, additions, or deletions)" needs WHO's prior written permission. Turning GHE into hazard tables for a game probably counts. Task 3 starts by checking whether GHE is published under an open licence on data.who.int. If it isn't, pick one:
   - **(a)** Ask WHO for written permission.
   - **(b)** Use the World Bank's cause-of-death indicators (CC BY 4.0): communicable vs non-communicable vs injury shares, road-traffic and NCD 30–70 mortality. Split within those groups with our own estimates, cited and marked `estimate: true`. This is the default if GHE isn't open.
2. **School completion by income and place (Task 4).** UIS data is CC BY-SA 4.0, so `data/life/vnm/school.json` must be released under CC BY-SA 4.0 too. The repo already ships assets under licences other than MIT, so the default is to accept this and say so in `SOURCES.md` and `public/assets/ATTRIBUTION.md`. The alternative is World Bank totals only, with estimated gradients.

## Clean-room rules

- Inputs are only the public datasets in "Data sources", the published studies cited in `data/life/effects.yaml`, and text we write.
- Never use 1in8b answers, catalogs, decision or event wording, or their Methods tables as inputs, test fixtures or calibration targets. Test fixtures are written by hand.
- Our names throughout. The engine id is `arena-life`, and `meta.engine` is `arena-life@<version>`.
- Lives made by 1in8b before the switch keep the 1in8b credit wherever they are still shown (memorials).

## The model

### The yearly loop

`step()` advances one year at a time until a decision waits, the life ends, or `until` is reached. Each year, in this order:

1. **History.** Periods active this year apply to the person if their region, age and sex match. They add event lines, shift some odds, and can raise a decision.
2. **Relatives.** Parents, siblings, the partner and children each roll their own death on the same tables, so parents die, partners are widowed, and children can die young.
3. **Illness.** Roll the onset of each chronic illness. Advance any illness the person has: health drops, events are added, and a treatment decision can wait.
4. **Death.** Roll the person's death, then pick the cause (competing risks, below).
5. **School.** At each stage boundary, roll whether the person goes on.
6. **Work.** Labour-force entry, sector and job, income changes, retirement.
7. **Family.** Partner, births, divorce.
8. **Moves.** Village to town, region to region, or abroad.
9. **Focus and spending.** The year's focus and any purchases move the stats.
10. **Decisions.** If an eligible decision fires, stop and return it.

### Rates

- **Lookup:** `rate(table, year, age, sex)`. Years past a table's last value keep the last value, except the WPP tables, which have projections to 2100. Ages past the last age group use the last group.
- **Yes/no events** roll once a year against a hazard: `rng() < rate × multipliers`.
- **Several options** (sector, cause of death, destination) use a softmax over `ln(base share) + Σ ln(multiplier)`.
- **Mean-one multipliers.** Each factor's multipliers average 1 over that year's population shares. Income fifths are 20% each, and town/village shares come from the yearly urban share. So the national rate still matches the table. The calibration tests catch any drift that is left.
- **Causes of death** are competing risks. The all-cause rate comes from the WPP life table. If the person dies, the cause is picked in proportion to each cause's share for that age group, sex and year, times the person's cause-specific multipliers (renormalized).
- **Gradual illness.** A chronic cause `c` has an average course `D_c` years and a cure share `cure_c`, both estimates taken from studies. Onset at age `a` uses the cause's death rate `D_c` years later, divided by `1 − cure_c`. While ill, the yearly death chance from `c` is about `1 / D_c`, lowered by treatment. Cancer deaths therefore arrive years after a diagnosis, while strokes and accidents stay sudden. A calibration test checks that cause-specific deaths still match.
- **Births only happen within a partnership.** Marital fertility is the age-specific fertility rate divided by the married share at that age and year, so total births still match the table.
- **Period vs cohort.** WPP tables are period rates. The calibration tests compare a simulated birth cohort with expectations computed from the same tables along that cohort's diagonal, never with period life expectancy.

### Rules that must never break

These are checked over thousands of lives by `invariants.test.ts`:

- No partner under 16. No birth to a mother outside ages 15–49, or to one who is dead.
- Nothing happens to anyone after their death. A dead relative can't die again or have a child.
- No school stage before the stage under it. No job before the minimum working age. No retirement without work.
- Relatives' ages are consistent: parents are older than the person by a plausible gap, and each child's age equals years since its birth.
- A decision is only offered when its `when` condition holds.
- The same seed and the same choices always give the same life, and `view` never advances the random number generator.

### Content rules (carried over from the spec)

- Ages 15 and up. Death is quiet and off-screen.
- Self-harm is never shown as a cause. Its share is redistributed across the other causes in proportion, so all-cause mortality is unchanged.
- Violence and conflict deaths get one quiet line: no method, no detail.
- The five life screens show a simulated-life notice and the data credits.
- History text is factual and neutral and covers people on every side. Each `history.yaml` row cites a source, and the whole file gets a separate review before merge.

---

## Data sources

Checked live on 2026-11-08. None of the routes below needs a key. The UN Data Portal API does need a bearer token, so use the bulk files instead.

| Source | Route | Licence | Viet Nam coverage | Used for |
|---|---|---|---|---|
| UN WPP 2024 | Bulk CSV.gz under `https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/` | CC BY 3.0 IGO | 1950–2023 estimates, 2024–2100 medium projections | Mortality, fertility, sex ratio, war deaths, sanity checks |
| WHO GHE 2023 | OData `https://xmart-api-public.who.int/DEX_CMS/GHE_FULL` (use `$select`) | WHO dataset terms (see Licence question 1) | 2000–2023 | Cause-of-death shares |
| World Bank WDI | `https://api.worldbank.org/v2/country/VNM/indicator/{code}?format=json&per_page=200` | CC BY 4.0 (World Bank default; check each indicator's label) | Varies by indicator, below | School totals, sectors, income, urban share |
| UNESCO UIS | `https://api.uis.unesco.org/api/public/data/indicators?geoUnit=VNM&indicator={code}` | CC BY-SA 4.0 | 2000–2021, sparse | Completion by income fifth, town/village and sex |
| UN World Marriage Data 2019 | `undesa_pd_2019_wmd_marital_status.xlsx` | CC BY 3.0 IGO | 13 survey years, 1988–2015 | Ever-married share by age group |
| UN International Migrant Stock 2024 | `undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx`, sheet `Table 1` | CC BY 3.0 IGO | 1990, 1995 … 2020, 2024 | Emigration by destination |

The two UN DESA files live under `https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/`.

**WPP files:**
- `WPP2024_Life_Table_Complete_Medium_{Female,Male}_1950-2023.csv.gz` and `…_2024-2100.csv.gz`, about 200 MB each.
  - Single ages 0–99 plus 100+, with `qx` among the columns.
  - Filter on `ISO3_code == "VNM"`. Use `AgeGrpStart` for the age, because the `AgeGrp` labels read `"1-1"`.
- `WPP2024_Fertility_by_Age1.csv.gz`, 302 MB.
  - It holds every projection variant, so filter `Variant == "Medium"`.
  - `ASFR` is per 1,000 women, so divide by 1,000.
- `WPP2024_Demographic_Indicators_Medium.csv.gz`, 17 MB: `SRB`, `Births`, `Deaths`, `LEx`, `TFR`.
- `4_Metadata/WPP2024_F02_Metadata.xlsx`, sheet `Mortality_Crises`: crisis deaths by country and year.

**War deaths are already inside WPP's mortality rates.** The WPP 2024 methodology report (§I.C.3) says excess deaths from conflicts, disasters and epidemics are added to the age- and sex-specific rates for 1950–2023.
- `Mortality_Crises` lists conflict deaths for Viet Nam in every year from 1950 to 1975: about 1.75 million in total, including 185,000 in 1968 and 240,000 in 1972.
- WPP life expectancy shows the dips: 52.7 in 1968 and 51.9 in 1972, against about 57 in the years around them.
- WPP lists no crisis deaths for 1976–2009, so the 1979 border war is not in the rates.

**GHE:**
- API fields: `DIM_YEAR_CODE`, `DIM_AGEGROUP_CODE`, `DIM_SEX_CODE`, `DIM_GHECAUSE_CODE`, `FLAG_LEVEL`, `VAL_DTHS_COUNT_NUMERIC`. There are about 360,000 rows for Viet Nam and about 226 causes in a 4-level tree.
- Age groups: `D0T27`, `M1T11`, `Y0T1`, `Y1T4`, then 5-year groups up to `Y_GE85`.
- The API's page-size limit is unverified.

**WDI indicators:**

| Codes | What | Viet Nam years |
|---|---|---|
| `SE.PRM.CMPT.ZS`, `SE.SEC.CMPT.LO.ZS` | Primary and lower-secondary completion rate | 1979, then 1999–2024 with gaps |
| `SE.TER.ENRR` | Tertiary gross enrolment | 1976–2024 with gaps |
| `SL.AGR.EMPL.ZS`, `SL.IND.EMPL.ZS`, `SL.SRV.EMPL.ZS` | Employment by sector; male/female variants exist | 1991–2025 |
| `NY.GDP.PCAP.PP.KD` | GDP per capita, PPP | 1990–2025 |
| `SP.URB.TOTL.IN.ZS` | Urban population, % | 1960–2025 |
| `SI.DST.FRST.20` … `SI.DST.05TH.20`, `SI.POV.GINI` | Income share by fifth, Gini | 1992, 1997, 2002, then every 2 years to 2022 |

**UIS:**
- Completion codes are `CR.1`, `CR.2` and `CR.3` (primary, lower secondary, upper secondary).
- Suffixes: `.Q1`–`.Q5` for income fifth, `.URB`/`.RUR` for town or village, `.F`/`.M` for sex.
- Viet Nam years: 2000, 2002, 2006, 2009, 2011, 2014, 2021. The income-fifth series skips 2002 and 2009, and `CR.2.Q1` also lacks 2006.

**Marriage:** sheets `EVER_MARRIED` and `SMAM`, in 5-year age groups by sex. A year can have several sources (census, DHS, MICS); keep one per year, preferring the census.

**Migrant stock:** 64 destinations for people born in Viet Nam; drop rows with location code ≥ 900, which are regional totals. These are stocks, not flows: 3.69 million in 2024, 1.43 million of them in the US.

**Gaps that need estimates or another source:**
- Sector shares before 1991 and GDP before 1990.
- School completion before 1999, apart from 1979.
- Marriage before 1988.
- Emigration before 1990: derive an average yearly outflow for 1975–1990 from the 1990 stock.

Candidate open sources for the earlier years are the Maddison Project (GDP) and the Wittgenstein Centre (schooling by birth cohort). Their licences aren't verified yet; check them in Task 4 before use. Otherwise hold the first observed value, marked `estimate: true`.

---

## Global Constraints

- No new runtime dependencies.
- `src/game/sim/` is pure TypeScript: no React, DOM, Zustand or `fetch`. All randomness comes from the seeded generator held in the token; `Math.random` is not used anywhere in `src/game/sim/`.
- Life data loads only with the lazy life chunk. Budget: 400 KB of JSON before compression. Measured after Task 4: 352 KB, of which `mortality.json` is 255 KB. If later data pushes past the budget, store `qx` with fewer digits before adding anything else.
- Any number that is not read straight from a table is an estimate. It carries `estimate: true` and a note or source in its data file. A `decision.fact` line only quotes sourced table values, never estimates.
- `npm run lint`, `npm test` and `npm run build` pass. `src/game/sim/**` joins the 80% coverage gate in `vitest.config.ts` (Task 5).
- Commit after every task.

## Review Focus

These are the failure modes most likely to make a life wrong. Each gets a test in the task that owns the code.

1. **War deaths counted twice.** WPP's rates already include the 1950–1975 war deaths (see "Data sources"). Conflict is a cause share inside all-cause mortality, never an extra hazard. History rows add no mortality of their own. The 1979 border war is not in WPP, so it adds event lines only.
2. **Multipliers drifting the national rate.** Income, place, health and illness multipliers must keep the population average on the table.
3. **Impossible states.** See "Rules that must never break".
4. **Period vs cohort.** Calibration targets come from cohort diagonals.
5. **Old 1in8b runs.** A saved run or memorial from 1in8b must not crash the game or lose its credit.
6. **History text.** Neutral, sourced and non-graphic, with no side ranked or demeaned.
7. **Determinism and token size.** Same seed and same choices give the same life. Tokens stay under 32 KB.
8. **Data gaps.** Causes of death before 2000 and job sectors before the first observed year are explicit estimates, labelled as such.

---

## File Structure

```
scripts/life-data/
  build.mjs                 downloads into .cache/life-data/, writes data/life/vnm/*.json
  sources.mjs               every source: URL, edition, licence
data/life/
  vnm/mortality.json        qx by single age 0–100 × sex × year 1950–2100 (WPP)
  vnm/fertility.json        ASFR by single age 15–49 × year; sex ratio at birth (WPP)
  vnm/causes.json           cause shares by age group × sex × year (GHE) + pre-2000 rule
  vnm/crises.json           conflict, disaster, epidemic and COVID-19 shares of deaths by year (WPP)
  vnm/school.json           stage progression by year, with income-fifth and town/village gradients
  vnm/work.json             employment by sector by year; income shares by fifth; GDP per capita PPP
  vnm/marriage.json         ever-married share by age group × sex × year
  vnm/migration.json        urban share by year; emigrant stock by destination × year
  vnm/SOURCES.md            each file: source, edition, URL, licence, retrieval date, transforms
  history.yaml              Vietnam periods and events: years, region, who, effects, text, source
  decisions.yaml            decision catalog: when, question, choices, effects, major, template
  events.yaml               event-line templates
  effects.yaml              relative-risk multipliers and illness courses, each with a citation
  names.yaml                family, middle and given names by sex and era
  catalog.yaml              yearly focus options and spending-sheet items
src/game/sim/
  rng.ts                    seeded, serializable generator (sfc32)
  tables.ts                 typed data access: lookups, clamping, interpolation
  pick.ts                   hazard roll, softmax pick, mean-one normalization
  person.ts                 Person, Relative, SimState; invariant checker
  birth.ts                  birth draw: sex, region, place, fifth, faith, name, parents, siblings
  mortality.ts              competing-risk death for the person and relatives
  illness.ts                chronic course: onset, decline, treatment
  family.ts                 partner, births, divorce, widowhood
  school.ts                 stage progression
  work.ts                   labour entry, sector, job, income, retirement
  migration.ts              moves within Vietnam and abroad
  history.ts                period effects and event lines
  decisions.ts              eligibility, choices, effects, policy default
  text.ts                   event-line rendering
  engine.ts                 start / step / view and the yearly loop
  token.ts                  encode and decode SimState (versioned)
  localTransport.ts         LifeTransport adapter over engine.ts
  *.test.ts                 unit tests per module
  calibration.test.ts       many-life checks against the tables
  invariants.test.ts        many-life checks of the never-break rules
src/game/ui/LifeCredit.tsx  one credit block for the five screens
```

Modify: `src/game/engine/types.ts`, `chapters.ts`, `director.ts`, `runLife.ts`; `src/game/state/lifeRun.ts`, `lifeStore.ts`, `persistence.ts`; `src/game/LifeGame.tsx`; `src/game/ui/StartScreen.tsx`, `LifeError.tsx`, `BirthCard.tsx`, `Journal.tsx`, `DeathScreen.tsx`, `Memorial.tsx`; `vitest.config.ts`; `package.json`; `.gitignore`; `README.md`; `CLAUDE.md`; the spec's status line.

Delete: `src/game/engine/oneIn8b.ts`, `src/game/engine/oneIn8b.test.ts`.

---

### Task 1: Engine-neutral types (no behaviour change)

**Files:** Modify `src/game/engine/types.ts` and every importer (17 files, found with `grep -rl "OneIn8b\|LiveResponse" src/game`).

- [x] Rename `OneIn8bState` → `LifeState`, `OneIn8bDecision` → `LifeDecision`, `OneIn8bChoice` → `LifeChoice`, `OneIn8bFocus` → `LifeFocus`, `OneIn8bSheetItem` → `LifeSheetItem`, `OneIn8bDeath` → `LifeDeath`, `OneIn8bMeta` → `LifeMeta`, `OneIn8bUsage` → `LifeUsage`, `OneIn8bEvent` → `LifeEvent`, `LiveResponse` → `LifeStepResult`, `OneIn8bError` → `LifeEngineError`.
- [x] Add optional `major?: boolean` and `template?: LifeTemplateId` to `LifeDecision`, plus `region?: "north" | "central" | "south"` to `LifeConfig` and `LifeState`. 1in8b never sends them, so behaviour is unchanged.
- [x] `npx tsc -b`, `npm run lint`, `npm test`: all green with no test logic changed, only names.

### Task 2: Data pipeline — mortality and fertility (WPP)

**Files:** Create `scripts/life-data/build.mjs`, `scripts/life-data/sources.mjs`, `data/life/vnm/mortality.json`, `data/life/vnm/fertility.json`, `data/life/vnm/SOURCES.md`. Modify `package.json` (`"life:data": "node scripts/life-data/build.mjs"`) and `.gitignore` (`.cache/`).

- [x] Download the WPP files listed in "Data sources" into `.cache/life-data/`, skipping files already there. The cache needs about 1.2 GB.
- [x] Stream each `.csv.gz` through `zlib` line by line and keep only `ISO3_code == "VNM"` rows. Never load a whole file into memory. Use only Node built-ins.
- [x] `mortality.json`: `{ years: [1950..2100], ages: [0..100], female: number[][], male: number[][] }`, with qx rounded to 6 significant digits. Ages come from `AgeGrpStart`; 100 means 100+.
- [x] `fertility.json`: ASFR for ages 15–49 by year (`Variant == "Medium"`, divided by 1,000), plus `SRB` by year from the Demographic Indicators file.
- [x] Sanity test: period life expectancy computed from our `qx` matches WPP's `LEx` within 0.2 years for every year from 1950 to 2100, including the 1968 and 1972 dips.
- [x] The output is deterministic: sorted keys, fixed rounding, and re-running produces no diff.
- [x] Write `SOURCES.md` rows: file, source, edition, URL, licence, retrieval date, transform.
- [x] Measure the JSON size and update the budget line in "Global Constraints".

### Task 3: Data pipeline — causes of death

**Files:** Extend `build.mjs`. Create `scripts/life-data/xlsx.mjs`, `data/life/vnm/crises.json` and `data/life/vnm/causes.json`.

- [x] Settle Licence question 1 first, and record the outcome in `SOURCES.md`. *Decided 2026-11-08: build with the World Bank's CC BY 4.0 groups now and ask WHO for permission; swap in GHE if granted.*
- [x] Cause shares, as built: `causes.json` holds the World Bank's three groups (communicable, non-communicable, injury; 2000–2021) and `deaths.json` holds WPP deaths by age band and sex. `causes.ts` turns them into a distribution over about 25 named causes using estimated age patterns from `effects.yaml`, raking whole groups each year so national shares match the World Bank's. Self-harm is never a named cause; those deaths fall proportionally on the other injury causes.
- [x] Outside 2000–2021, hold the *age-standardized group factors* of the nearest published year (not the national shares), so decades with many child deaths get more infectious deaths on their own. Crisis deaths are taken out of the World Bank groups first (COVID-19 and epidemics from communicable, war and disasters from injury) so nothing is counted twice.
- [x] Tests: every distribution sums to 1; national group shares match the World Bank in every published year (±0.2 points); the war share matches WPP in 1968 and 1972.

### Task 4: Data pipeline — school, work, marriage, migration

**Files:** Extend `build.mjs`. Create `school.json`, `work.json`, `marriage.json` and `migration.json` in `data/life/vnm/`.

- [ ] Check the Maddison Project and Wittgenstein Centre licences. Use them for the years before 1990 only if they are open; otherwise use estimates (see "Gaps"). *Not done yet: v1 holds the first observed value, in engine code.*
- [x] `school.json`: the chance of finishing each stage (primary, lower secondary, upper secondary, tertiary entry) by the year a child reaches it, from WDI totals. Add income-fifth, town/village and sex multipliers from UIS `CR.*` (Licence question 2), normalized to mean one and interpolated between survey years.
- [x] `work.json`: sector shares (`SL.*.EMPL.ZS`, by sex), income share by fifth (`SI.DST.*`), and GDP per capita PPP (`NY.GDP.PCAP.PP.KD`) by year.
- [x] `marriage.json`: `EVER_MARRIED` by 5-year age group × sex, one source per survey year, interpolated between years. Derive the first-marriage hazard from differences between age groups. Before 1988, hold 1988, marked as an estimate.
- [x] `migration.json`: urban share (`SP.URB.TOTL.IN.ZS`) and emigrant stock by destination × year. Derive a yearly emigration hazard from stock changes. Before 1990, spread the 1990 stock as an average outflow over 1975–1990, marked as an estimate.
- [x] Each file has a `SOURCES.md` row, with its licence. `school.json` is CC BY-SA 4.0. Every value that is not straight from a table is marked as an estimate.

*As built:* the four files keep values as published (sparse, by year; UIS and WDI in percent). Interpolation, the 3–5-year lag in UIS completion, hazards derived from marriage shares and stock changes, and gap-filling all live in engine code (Tasks 9–11), where they are tested.

### Task 5: Sim core — generator, tables, picks

**Files:** Create `src/game/sim/rng.ts`, `tables.ts`, `pick.ts` and their tests. Modify `vitest.config.ts` to add `src/game/sim/**/*.ts` to `coverage.include`.

**Produces:**
- `createRng(seed: number): Rng`, where `Rng` is `{ next(): number; state(): number[] }`, plus `restoreRng(state: number[]): Rng`.
- `qx(year, age, sex)`, `asfr(year, age)`, `causeShares(year, ageGroup, sex)`, `stageChance(year, stage, fifth, place)`, `sectorShares(year)`, `marriedShare(year, ageGroup, sex)`, `urbanShare(year)`, `emigration(year)`.
- `roll(rng, p): boolean`, `softmaxPick(rng, options: { key: string; logWeight: number }[]): string`, `meanOne(multipliers, weights)`.

- [x] Tests come first. The same seed gives the same sequence. Restoring a saved state continues the sequence exactly. Lookups clamp out-of-range years and ages as described in "Rates". `softmaxPick` frequencies over 100,000 draws match the weights within ±1 percentage point. `meanOne` output has a weighted mean of 1.

### Task 6: Person model and birth

**Files:** Create `src/game/sim/person.ts`, `birth.ts`, `data/life/names.yaml`, `data/life/birth.yaml` (region and faith shares from the 2019 census, parent age gap, starting stats; all estimates), and tests.

**Produces:** `SimState` (`person`, `relatives`, `year`, `age`, `stats`, `illnesses`, `pendingDecision`, `focus`, `rng`, `ended`, `death`); `drawBirth(config: LifeConfig, rng): SimState`; `checkInvariants(state): string[]`.

- [x] Draw sex from the sex ratio at birth. Draw region, town/village and faith from population shares; town/village uses the urban share for the birth year. The income fifth is uniform. Any config value overrides its draw.
- [x] Parents: the mother's age at the birth comes from that year's ASFR shape; the father is older by a sampled gap (an estimate). The number of older siblings is sampled from the mother's age and the cohort's fertility. Parents and siblings are `Relative`s with their own sex, age and alive flag.
- [x] Names: family name by population share, middle name by sex and era, given name by sex and era. `names.yaml` is our own list, with sources for the family-name shares.
- [x] Tests: config overrides are respected; `checkInvariants` on 5,000 births returns no errors; the sex ratio over 20,000 births is within ±1% of the table.

### Task 7: Mortality and causes

**Files:** Create `src/game/sim/mortality.ts`, `src/game/sim/causes.ts`, `data/life/effects.yaml` (mortality multipliers, cause patterns, crisis weights) and tests. Start `calibration.test.ts`.

*As built:* the health stat does not yet change the death rate; illness does that in Task 8. Crisis weights use water-filling so no age band passes 90% crisis deaths while the national share stays exact. Calibration (4,000 lives per cohort) lands within 1 year for 1950, 1975 and 2000, both sexes.

- [x] Yearly death rolls for the person and every living relative. The multipliers are income fifth, town/village and the health stat, each normalized to mean one.
- [x] Cause pick by competing risks, with hidden causes redistributed (see "Content rules").
- [x] Conflict cause for 1950–1975, picked as one share inside the competing risks (Task 3), weighted by region, age and sex.
- [x] Calibration: for birth cohorts 1950, 1975 and 2000, simulated mean age at death over 4,000 lives is within ±1.0 year of the life expectancy computed along the cohort diagonal of `mortality.json`. Simulated cause shares for adults aged 30–69 are within ±3 percentage points of the table for every cause above 5%.

### Task 8: Chronic illness course

**Files:** Create `src/game/sim/illness.ts`, extend `effects.yaml` (courses `D_c` and cure shares `cure_c`, cited) and add tests.

- [x] Chronic causes (cancers, COPD, heart failure; the final list goes in `effects.yaml`) get an onset roll, a yearly decline in health, event lines and a treatment decision. Treatment lowers the yearly death chance from that illness. Without treatment it is about `1 / D_c`.
- [x] Deaths from these causes come only from the illness course; the competing-risk pick in Task 7 skips them.
- [x] Calibration: mean age at death stays within 1 year of the UN tables with illness on; the long-illness share of deaths at 30–69 is within 4 points of what the cause tables expect; mean years from diagnosis to death are within 1 year of the courses (about 2.7–3 years).

*As built:* the course is two yearly exit rates (1 / years overall, split by the cure share), so a diagnosis can end in recovery or death. The sudden-death roll leaves out the long-illness share. Treatment (`treatIllness`) is wired to a decision in Task 12. Relatives still die suddenly of any cause.

### Task 9: Family — partner, children, divorce, widowhood

**Files:** Create `src/game/sim/family.ts` and tests.

- [x] First partnership from the marriage hazard (age 16 and up). The partner's age gap is an estimate in `effects.yaml`, and the partner becomes a `Relative`.
- [x] Births only within a partnership, at the marital fertility rate (see "Rates"), for the woman in the couple aged 15–49. Children become `Relative`s from age 0.
- [x] Divorce at a low estimated rate, cited. Widowhood comes from the partner's own death roll in Task 7.
- [x] Calibration: for women born in 1960 and 1985, the simulated mean number of children is within ±0.15 of the cohort total fertility computed along the ASFR diagonal. The ever-married share by age group is within ±5 percentage points of `marriage.json`.

*As built:* younger siblings come from the mother's married fertility while both parents live. A partner's death is recorded in the relatives' death roll (`widowed`), so a person who dies later the same year is never left partnered to someone dead. Partnerships are between a man and a woman because the marriage data is; same-sex partnerships are a follow-up. Calibration: women born 1960 who reach 50 have 3.07 children (UN 3.12), born 1985 1.80 (UN 1.95); ever-partnered shares are within 3.2 points of the UN's at the ages checked.

### Task 10: School, work, income, retirement

**Files:** Create `src/game/sim/school.ts`, `work.ts` and tests.

- [ ] School stages in order. The chance of going on uses `stageChance` with the income-fifth and town/village multipliers, plus the knowledge stat (mean one).
- [ ] Labour entry after leaving school. The sector is a softmax over `sectorShares(year)` times education multipliers; the job title comes from an authored list per sector and education level. Income is the person's place in the national distribution (income fifth plus education), turned into money with GDP per capita PPP.
- [ ] Retirement at the legal age for that year and sex (cited in `effects.yaml`).
- [ ] Calibration: primary and lower-secondary completion for cohorts 1980 and 2000 are within ±5 percentage points of `school.json`. Sector shares among working-age people in 1995 and 2015 are within ±5 points of `work.json`.

### Task 11: History, moves, disasters

**Files:** Create `src/game/sim/history.ts`, `migration.ts`, `data/life/history.yaml` and tests.

- [ ] `history.yaml` rows: `id`, `from`, `to`, `regions`, `who` (age/sex filter), `effects` (hazard multipliers, sector shocks, migration pushes), `lines` (event text), `decision` (optional id), `source`. The initial scope is the main periods from 1950 to 2025: wartime and partition, reunification, the subsidy era, the 1979 border conflicts, departures by sea, Đổi Mới, the Asian financial crisis, WTO entry, COVID-19, and major named typhoons and floods by region. Every row is cited.
- [ ] Moves: village to town using the urban-share trend; emigration using `migration.json` plus history pushes, with the destination picked by softmax over stock shares.
- [ ] Tests: a life born in 2005 never receives a war-era row. A life born in 1950 in each region receives that region's rows at the right ages. No history row changes the mortality hazard, so simulated all-cause mortality for 1965–1975 stays on the WPP table (Review Focus 1).

### Task 12: Decisions, focus, spending, text

**Files:** Create `src/game/sim/decisions.ts`, `text.ts`, `data/life/decisions.yaml`, `events.yaml`, `catalog.yaml` and tests.

- [ ] Decision rows: `id`, `when` (age, year, state conditions), `question`, `about`, `fact` (a template that only quotes sourced table values), `choices` (`key`, `label`, `note`, `effects`, `share` = how often people pick it), `major`, `template`. The first set covers continuing school, the university entrance exam, the first job, moving to a city, marriage, another child, caring for a parent, treatment, emigrating, borrowing or saving, retiring, and family-level choices in war years such as evacuating children.
- [ ] The policy default is the choice with the highest `share`. `defaultChoiceKey` in `chapters.ts` uses it (Task 14).
- [ ] Focus options (study, work, health, family, rest) and spending items (our catalog, e.g. extra classes, health insurance, a motorbike) move the stats a little, by amounts in `catalog.yaml`.
- [ ] `text.ts` fills the templates (`{name}`, `{year}`, `{place}`, `{relative}`).
- [ ] Tests: every decision's `when` is checked against its eligible and ineligible cases; every `fact` template resolves to a sourced value; every choice key is unique within its decision.

### Task 13: Engine API, token, local transport

**Files:** Create `src/game/sim/engine.ts`, `token.ts`, `localTransport.ts`, `invariants.test.ts`, and tests.

**Produces:**
- `startLife(config): LifeStepResult` and `stepLife(token, body: StepBody): LifeStepResult`. With `view`, `stepLife` decodes and returns the result without advancing.
- `encodeToken(state)` and `decodeToken(token)`. The token is versioned base64 JSON, rejected with code `token` if the version or shape is wrong.
- `createLocalTransport(): LifeTransport`, which wraps the engine in resolved promises.

- [ ] `meta` is `{ engine: "arena-life@<version>", simulated: "Simulated lives, not real people." }`; there is no `usage`.
- [ ] `until: "decision"` (the default) and `until: "year"` behave as their names say. An invalid `choose` key throws `LifeEngineError` with code `invalid_choice`.
- [ ] `invariants.test.ts` runs 2,000 seeded lives to the end with the policy default and asserts that `checkInvariants` is empty after every step.
- [ ] Determinism: two runs with the same seed and choices produce identical results at every step. `view` leaves the token unchanged. The largest token over the 2,000 lives is under 32 KB.

### Task 14: Game integration

**Files:** Modify `lifeStore.ts`, `chapters.ts`, `director.ts`, `persistence.ts`, `LifeGame.tsx`, `StartScreen.tsx`, `LifeError.tsx`; create `src/game/ui/LifeCredit.tsx`; use it in `BirthCard.tsx`, `Journal.tsx`, `DeathScreen.tsx`, `Memorial.tsx` and `StartScreen.tsx`.

- [ ] `buildDeps()` always uses `createLocalTransport()`; the missing-key path goes away. `setLifeDeps` stays for tests.
- [ ] `isMajorDecision` uses `decision.major` when present; `defaultChoiceKey` uses `share`; `selectTemplate` uses `decision.template` when present. The keyword rules stay as a fallback.
- [ ] `StartScreen`: remove the key field and the 1in8b links; add a region select; birth years 1950–2025; hide disability.
- [ ] `LifeError` messages cover `token`, `invalid_choice` and `unknown`; the key, quota and rate messages go away.
- [ ] Old runs: if a saved run's `engineVersion` does not start with `arena-life@`, the game explains that this life began on the 1in8b Engine. It offers to keep it as an unfinished memorial, credited to 1in8b, or to discard it.
- [ ] `LifeCredit` shows the data credits for `arena-life` lives and the 1in8b credit for lives made by 1in8b.
- [ ] Update `runLife.test.ts` and `lifeRun.test.ts` for the new deps. Add a store test that starts a life with no key.

### Task 15: Remove 1in8b and update the docs

**Files:** Delete `src/game/engine/oneIn8b.ts` and its test. Modify `README.md`, `CLAUDE.md` and the spec's status line.

- [ ] On first load, `localStorage.removeItem("agent-arena-life-key")`, so no old key lingers.
- [ ] README: the "Life in Vietnam" section explains the local engine, the data sources and their credits, and that no key is needed.
- [ ] `CLAUDE.md`: replace the Engine and State bullets of the Life section with the sim layout, the data build and the calibration tests.
- [ ] `grep -ri "1in8b" src/ README.md` returns only the legacy credit in `LifeCredit.tsx` and the old-run notice.

### Task 16: Full-arc verification

- [ ] `npm run lint`, `npm test`, `npm run build`. Record the life chunk's size against the main bundle.
- [ ] Play three lives in Chromium with DevTools set to offline: born 1950 in the North in a village (male), born 1975 in the South in a town (female), born 2005 in the Central region in a village. Check:
  - The war years appear only for the 1950 life, at the right ages and region.
  - A cancer death shows a diagnosis and decline over several years (find a seed with a helper test that searches seeds).
  - Reload mid-scene and resume.
  - The journal reads well from start to end.
  - The credits appear on all five screens.
- [ ] Print the calibration report (`npx vitest run src/game/sim/calibration.test.ts`) and paste the table into the PR.

---

## Follow-up (not in this plan)

- Vietnamese locale for the life text.
- Destination-country tables for emigrants.
- Births in the future (2026 onward) on the UN projections.
- Disability, with sourced rates.
- Individual-level survey data (census samples, household surveys) to estimate real choice-model coefficients instead of borrowing effect sizes.
- Province-level rates.
- The LLM scene director, more scene templates, audio (unchanged from the spec's follow-up list).
