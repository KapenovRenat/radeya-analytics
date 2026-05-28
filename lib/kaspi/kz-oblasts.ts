/**
 * Kazakhstan oblast classifier.
 *
 * Maps a city name from Kaspi delivery address (`delivery_address_city` or `town`)
 * to one of 20 oblast codes. Code values match SVG path IDs used by the heatmap.
 *
 * Port of oblast_mapping CASE from kaspi_analytics_routes.py:478-503.
 */

export type OblastCode =
  | "almaty_city"
  | "astana_city"
  | "shymkent_city"
  | "karaganda"
  | "pavlodar"
  | "kostanay"
  | "aktobe"
  | "atyrau"
  | "mangystau"
  | "kyzylorda"
  | "turkestan"
  | "zhambyl"
  | "east_kz"
  | "west_kz"
  | "north_kz"
  | "akmola"
  | "zhetysu"
  | "almaty_oblast"
  | "ulytau"
  | "abai"
  | "other";

export const OBLAST_NAMES: Record<OblastCode, string> = {
  almaty_city: "г. Алматы",
  astana_city: "г. Астана",
  shymkent_city: "г. Шымкент",
  karaganda: "Карагандинская область",
  pavlodar: "Павлодарская область",
  kostanay: "Костанайская область",
  aktobe: "Актюбинская область",
  atyrau: "Атырауская область",
  mangystau: "Мангистауская область",
  kyzylorda: "Кызылординская область",
  turkestan: "Туркестанская область",
  zhambyl: "Жамбылская область",
  east_kz: "Восточно-Казахстанская область",
  west_kz: "Западно-Казахстанская область",
  north_kz: "Северо-Казахстанская область",
  akmola: "Акмолинская область",
  zhetysu: "Жетысуская область",
  almaty_oblast: "Алматинская область",
  ulytau: "Улытауская область",
  abai: "Область Абай",
  other: "Прочее",
};

const RULES: { oblast: OblastCode; patterns: RegExp[] }[] = [
  { oblast: "almaty_city", patterns: [/алматы/i, /almaty/i] },
  { oblast: "astana_city", patterns: [/астана/i, /astana/i, /нур[- ]?султан/i] },
  { oblast: "shymkent_city", patterns: [/шымкент/i, /shymkent/i] },
  {
    oblast: "karaganda",
    patterns: [/караганд/i, /karagand/i, /темиртау/i, /жезказган/i, /сатпаев/i, /балхаш/i, /шахтинск/i],
  },
  { oblast: "pavlodar", patterns: [/павлодар/i, /аксу/i, /экибастуз/i] },
  { oblast: "kostanay", patterns: [/костанай/i, /рудный/i, /лисаковск/i, /аркалык/i] },
  { oblast: "aktobe", patterns: [/актобе/i, /aktobe/i, /хромтау/i] },
  { oblast: "atyrau", patterns: [/атырау/i, /atyrau/i] },
  { oblast: "mangystau", patterns: [/мангистау/i, /актау/i, /жанаозен/i, /мангышлак/i] },
  { oblast: "kyzylorda", patterns: [/кызылорда/i, /байконур/i] },
  { oblast: "turkestan", patterns: [/туркестан/i, /turkestan/i, /кентау/i, /арыс/i] },
  { oblast: "zhambyl", patterns: [/тараз/i, /жамбыл/i, /каратау/i] },
  {
    oblast: "east_kz",
    patterns: [/усть[- ]?каменогорск/i, /семей/i, /риддер/i, /курчатов/i, /зыряновск/i],
  },
  { oblast: "west_kz", patterns: [/уральск/i, /орал/i] },
  { oblast: "north_kz", patterns: [/петропавловск/i] },
  { oblast: "akmola", patterns: [/кокшетау/i, /степногорск/i] },
  { oblast: "zhetysu", patterns: [/талдыкорган/i, /текели/i] },
  { oblast: "ulytau", patterns: [/улытау/i, /жезди/i] },
  { oblast: "abai", patterns: [/^абай/i] },
];

export function classifyCityToOblast(city: string | null | undefined): OblastCode {
  if (!city) return "other";
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(city))) return rule.oblast;
  }
  return "other";
}
