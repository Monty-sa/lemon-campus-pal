const url = process.argv[2];
const response = await fetch(url, { redirect: "follow" });
const html = await response.text();

const clean = (value = "") =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const decodeEntities = (value = "") =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

const selects = [...html.matchAll(/<select\b[^>]*name=["']?([^"' >]+)[^>]*>([\s\S]*?)<\/select>/gi)].map(
  (match) => ({
    name: match[1],
    options: [...match[2].matchAll(/<option\b[^>]*value=["']?([^"' >]*)[^>]*>([\s\S]*?)<\/option>/gi)]
      .slice(0, 20)
      .map((option) => ({ value: option[1], label: clean(option[2]) })),
  }),
);

const result = {
  status: response.status,
  finalUrl: response.url,
  contentType: response.headers.get("content-type"),
  bytes: Buffer.byteLength(html),
  title: decodeEntities(clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1])),
  forms: [...html.matchAll(/<form\b[^>]*>/gi)].map((match) => match[0]).slice(0, 20),
  selects,
  headings: [
    ...new Set(
      [...html.matchAll(/<(?:th|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:th|h[1-6])>/gi)]
        .map((match) => clean(match[1]))
        .filter(Boolean),
    ),
  ].slice(0, 150),
  tableCount: (html.match(/<table\b/gi) ?? []).length,
  scripts: [...html.matchAll(/<script\b[^>]*src=["']([^"']+)/gi)].map((match) => match[1]).slice(0, 30),
  links: [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: decodeEntities(match[1]), text: decodeEntities(clean(match[2])) }))
    .filter((link) => /p_trm_code|p_col_code|p_sex_code|ws/i.test(link.href))
    .slice(0, 100),
  dynamicRequestHints: /fetch\s*\(|XMLHttpRequest|ajax/i.test(html),
  parameterMentions: Object.fromEntries(
    ["p_trm_code", "p_col_code", "p_sex_code"].map((key) => [key, (html.match(new RegExp(key, "gi")) ?? []).length]),
  ),
  sampleRows: [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => clean(cell[1])))
    .filter((row) => row.length >= 4 && row.some(Boolean))
    .slice(0, 25),
};

console.log(JSON.stringify(result, null, 2));
