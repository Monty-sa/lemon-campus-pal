import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseKfuHtml } from "../src/lib/kfu-importer";

const sourceUrl = process.argv[2] ?? "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=11";
const outputPath = resolve(process.argv[3] ?? "data/kfu-import.json");
const url = new URL(sourceUrl);
const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "LEMON-KFU-Planner/0.1 (student prototype; read-only single import)" } });
if (!response.ok) throw new Error(`Could not fetch the source: HTTP ${response.status}`);
const html = await response.text();
const result = parseKfuHtml(html, {
  termId: url.searchParams.get("p_trm_code") ?? "unknown",
  collegeCode: url.searchParams.get("p_col_code") ?? "unknown",
  categoryCode: url.searchParams.get("p_sex_code") ?? "unknown",
  sourceUrl: response.url,
});
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`Imported ${result.courses.length} courses and ${result.sections.length} sections to ${outputPath}`);
