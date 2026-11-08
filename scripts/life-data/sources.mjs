// Every public source the life engine's data is built from.
// Keep this list in sync with data/life/vnm/SOURCES.md.

export const ISO3 = "VNM";

export const WPP = {
  name: "World Population Prospects 2024",
  publisher: "United Nations, Department of Economic and Social Affairs, Population Division",
  licence: "CC BY 3.0 IGO",
  base: "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/",
  files: {
    lifeFemale: [
      "WPP2024_Life_Table_Complete_Medium_Female_1950-2023.csv.gz",
      "WPP2024_Life_Table_Complete_Medium_Female_2024-2100.csv.gz",
    ],
    lifeMale: [
      "WPP2024_Life_Table_Complete_Medium_Male_1950-2023.csv.gz",
      "WPP2024_Life_Table_Complete_Medium_Male_2024-2100.csv.gz",
    ],
    fertility: "WPP2024_Fertility_by_Age1.csv.gz",
    indicators: "WPP2024_Demographic_Indicators_Medium.csv.gz",
    deaths: "WPP2024_DeathsBySingleAgeSex_Medium_1950-2023.csv.gz",
  },
  /** Excess deaths from conflicts, disasters and epidemics that WPP folds into its mortality. */
  crises: {
    url: "https://population.un.org/wpp/assets/Excel%20Files/4_Metadata/WPP2024_F02_Metadata.xlsx",
    file: "WPP2024_F02_Metadata.xlsx",
    sheet: "Mortality_Crises",
  },
};

export const WDI = {
  name: "World Development Indicators",
  publisher: "World Bank",
  licence: "CC BY 4.0",
  url: (code) => `https://api.worldbank.org/v2/country/${ISO3}/indicator/${code}?format=json&per_page=200`,
  school: ["SE.PRM.CMPT.ZS", "SE.SEC.CMPT.LO.ZS", "SE.TER.ENRR"],
  work: [
    "SL.AGR.EMPL.ZS",
    "SL.IND.EMPL.ZS",
    "SL.SRV.EMPL.ZS",
    "SL.AGR.EMPL.FE.ZS",
    "SL.IND.EMPL.FE.ZS",
    "SL.SRV.EMPL.FE.ZS",
    "SL.AGR.EMPL.MA.ZS",
    "SL.IND.EMPL.MA.ZS",
    "SL.SRV.EMPL.MA.ZS",
    "NY.GDP.PCAP.PP.KD",
    "SI.DST.FRST.20",
    "SI.DST.02ND.20",
    "SI.DST.03RD.20",
    "SI.DST.04TH.20",
    "SI.DST.05TH.20",
    "SI.POV.GINI",
  ],
  migration: ["SP.URB.TOTL.IN.ZS"],
  // Cause-of-death groups (% of deaths) derived by the World Bank from WHO's Global Health
  // Estimates and published under CC BY 4.0, plus road-traffic deaths per 100,000.
  causes: ["SH.DTH.COMM.ZS", "SH.DTH.NCOM.ZS", "SH.DTH.INJR.ZS", "SH.STA.TRAF.P5"],
};

export const UIS = {
  name: "UIS Data Browser, completion rates",
  publisher: "UNESCO Institute for Statistics",
  licence: "CC BY-SA 4.0",
  url: (codes) =>
    `https://api.uis.unesco.org/api/public/data/indicators?geoUnit=${ISO3}&${codes.map((c) => `indicator=${c}`).join("&")}`,
  // CR.1 primary, CR.2 lower secondary, CR.3 upper secondary; by income fifth, location and sex.
  codes: [1, 2, 3].flatMap((level) =>
    ["", ".Q1", ".Q2", ".Q3", ".Q4", ".Q5", ".URB", ".RUR", ".F", ".M"].map((suffix) => `CR.${level}${suffix}`),
  ),
};

const DESA_FILES = "https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/";

export const MARRIAGE = {
  name: "World Marriage Data 2019",
  publisher: "United Nations, Department of Economic and Social Affairs, Population Division",
  licence: "CC BY 3.0 IGO",
  file: "undesa_pd_2019_wmd_marital_status.xlsx",
  url: `${DESA_FILES}undesa_pd_2019_wmd_marital_status.xlsx`,
  sheet: "EVER_MARRIED",
  country: "Viet Nam",
  /** When a year has several sources, the first match wins. */
  preference: [/Census/, /Annual APC/, /DHS/, /MICS/, /AIS/],
};

export const MIGRANTS = {
  name: "International Migrant Stock 2024",
  publisher: "United Nations, Department of Economic and Social Affairs, Population Division",
  licence: "CC BY 3.0 IGO",
  file: "undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx",
  url: `${DESA_FILES}undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx`,
  sheet: "Table 1",
  originCode: 704,
  /** Destinations below this many people born in Viet Nam (2024) are grouped as "Other". */
  minStock: 10_000,
};
