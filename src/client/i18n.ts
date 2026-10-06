import sl from "./locales/sl.json";
export type Language = "en" | "sl";
export const language: Language = (() => {
  if (typeof window === "undefined") return "en";
  const chosen =
    localStorage.getItem("estate-language") ||
    new URLSearchParams(location.search).get("lang");
  return chosen === "sl" || (!chosen && navigator.language.startsWith("sl"))
    ? "sl"
    : "en";
})();
const slovenianBoardNames: Record<string, string> = {
  GO: "START",
  "Mediterranean Avenue": "Fiesa",
  "Community Chest": "Državna blagajna",
  "Baltic Avenue": "Šobec",
  "Income Tax": "Davek na dohodek",
  "Reading Railroad": "Železniška postaja Jesenice",
  "Oriental Avenue": "Ljutomerske gorice",
  Chance: "Priložnost",
  "Vermont Avenue": "Haloze",
  "Connecticut Avenue": "Goriška Brda",
  "Jail / Just Visiting": "V zaporu / Samo na obisku",
  "St. Charles Place": "Bogenšperk",
  "Electric Company": "Javna razsvetljava",
  "States Avenue": "Otočec",
  "Virginia Avenue": "Bohinj",
  "Pennsylvania Railroad": "Glavni kolodvor",
  "St. James Place": "Vogel",
  "Tennessee Avenue": "Rogla",
  "New York Avenue": "Kranjska Gora",
  "Free Parking": "Brezplačno parkiranje",
  "Kentucky Avenue": "Terme Čatež",
  "Indiana Avenue": "Radenci",
  "Illinois Avenue": "Moravske toplice",
  "B. & O. Railroad": "Železniška postaja Zidani Most",
  "Atlantic Avenue": "Logarska dolina",
  "Ventnor Avenue": "Trenta",
  "Water Works": "Mestni vodovod",
  "Marvin Gardens": "Lipica",
  "Go to Jail": "Pojdi v zapor",
  "Pacific Avenue": "Cerkniško jezero",
  "North Carolina Avenue": "Bled",
  "Pennsylvania Avenue": "Bohinj",
  "Short Line": "Železniški terminal Koper",
  "Park Place": "Piran",
  "Luxury Tax": "Davek na premoženje",
  Boardwalk: "Portorož",
  "COLLECT $200": "PREJMI $200",
  JAIL: "ZAPOR",
  "JUST VISITING": "SAMO NA OBISKU",
  "FREE PARKING": "BREZPLAČNO PARKIRANJE",
  "GO TO JAIL": "POJDI V ZAPOR",
};
const dictionary = {
  ...(sl as Record<string, string>),
  ...slovenianBoardNames,
};
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const entries = Object.entries(dictionary).sort(
  (a, b) => b[0].length - a[0].length,
);
const lookup = new Map(
  entries.map(([en, translated]) => [en.toLowerCase(), translated]),
);
const templates = entries
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => ({
    key,
    pattern: new RegExp(
      "^" +
        key
          .split(/(\{\d+\})/)
          .map((part) => (/^{\d+}$/.test(part) ? "(.*?)" : escapeRegex(part)))
          .join("") +
        "$",
    ),
    value,
  }));
const phrases = new RegExp(
  `(?<![\\p{L}])(?:${entries
    .filter(([key]) => !/\{\d+\}/.test(key) && !["on", "off"].includes(key))
    .map(([key]) => escapeRegex(key))
    .join("|")})(?![\\p{L}])`,
  "giu",
);
// Only player-entered names are protected. Board names have locale-specific
// equivalents and must remain translatable in the UI and event log.
let names: string[] = [];
export function protectNames(values: string[]) {
  names = values.filter(Boolean).sort((a, b) => b.length - a.length);
}
// Board printing and game panels share the selected edition's place names.
export function boardLabel(text: string): string {
  return language === "sl" ? slovenianBoardNames[text] || text : text;
}
export function translate(text: string, locale: Language = language): string {
  if (locale !== "sl" || !text.trim() || /^https?:\/\//.test(text.trim()))
    return text;
  if (names.includes(text.trim())) return text;
  if (dictionary[text.trim()])
    return text.replace(text.trim(), dictionary[text.trim()]);
  for (const { key, pattern, value } of templates) {
    const match = text.trim().match(pattern);
    if (match)
      return text.replace(
        text.trim(),
        value.replace(/\{(\d+)\}/g, (_, n) =>
          key === "{0} and {1} signed a deal{2}" && n === "2"
            ? match[3]
            : translate(match[Number(n) + 1], locale),
        ),
      );
  }
  const sentences = text.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u);
  if (sentences.length > 1)
    return sentences.map((sentence) => translate(sentence, locale)).join(" ");
  let protectedText = text;
  const saved: string[] = [];
  for (const name of names)
    protectedText = protectedText.replaceAll(
      name,
      () => `\uE000${saved.push(name) - 1}\uE001`,
    );
  const output = protectedText.replace(phrases, (match) => {
    const result =
      dictionary[match] || lookup.get(match.toLowerCase()) || match;
    return match.length > 2 && match === match.toUpperCase()
      ? result.toLocaleUpperCase("sl")
      : result;
  });
  return output.replace(/\uE000(\d+)\uE001/g, (_, n) => saved[Number(n)]);
}
// Translate only rendered text/accessible labels. IDs, form values, messages and saves stay stable.
// Originals are retained so incremental rendering never translates a translation twice.
export function installLocalization(root: HTMLElement) {
  document.documentElement.lang = language;
  document.title =
    language === "sl"
      ? "Estate Exchange · Igra lastništva"
      : "Estate Exchange · A game of ownership";
  if (language !== "sl") return;
  const originals = new WeakMap<Text, { source: string; result: string }>();
  const attrs = new WeakMap<
    Element,
    Map<string, { source: string; result: string }>
  >();
  const apply = () => {
    observer.disconnect();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node as Text;
      if (
        text.parentElement?.closest(
          'script,style,textarea,[translate="no"],.offer-note',
        )
      )
        continue;
      const prev = originals.get(text);
      const source =
        prev && prev.result === text.data ? prev.source : text.data;
      const result = translate(source);
      originals.set(text, { source, result });
      if (text.data !== result) text.data = result;
    }
    for (const el of root.querySelectorAll(
      "[title],[aria-label],[placeholder],[data-help]",
    )) {
      if (el.closest('[translate="no"]')) continue;
      const cache = attrs.get(el) || new Map();
      attrs.set(el, cache);
      for (const name of ["title", "aria-label", "placeholder", "data-help"]) {
        const value = el.getAttribute(name);
        if (!value) continue;
        const prev = cache.get(name);
        const source = prev && prev.result === value ? prev.source : value;
        const result = translate(source);
        cache.set(name, { source, result });
        if (result !== value) el.setAttribute(name, result);
      }
    }
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["title", "aria-label", "placeholder", "data-help"],
    });
  };
  const observer = new MutationObserver(apply);
  apply();
}
