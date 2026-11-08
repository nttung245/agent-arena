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
  },
};
