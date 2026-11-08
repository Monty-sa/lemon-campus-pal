const [url, pattern = "1448"] = process.argv.slice(2);
const response = await fetch(url);
const text = await response.text();
const expression = new RegExp(`.{0,300}${pattern}.{0,700}`, "giu");
for (const match of text.matchAll(expression)) {
  console.log(match[0].replace(/\s+/g, " "));
}
