// Checks portfolio.json and filters.json for mistakes that would break the
// Portfolio page. The rules live in scripts/portfolio-rules.js, which the
// project editor (admin.html) uses too.
// Run locally with: node scripts/check-portfolio.mjs
import { readFileSync, existsSync } from 'node:fs';
import { runInThisContext } from 'node:vm';

runInThisContext(readFileSync(new URL('./portfolio-rules.js', import.meta.url), 'utf8'));
const { validate } = globalThis.PortfolioRules;

function readJson(file, hint) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`${file} is missing or not valid JSON: ${err.message}`);
    if (hint) console.error(hint);
    process.exit(1);
  }
}

const items = readJson('portfolio.json', '(Common causes: a missing or extra comma, or an unescaped quote inside a string.)');
const filters = readJson('filters.json');
const indexHtml = existsSync('index.html') ? readFileSync('index.html', 'utf8') : undefined;

const { errors, warnings } = validate(items, filters, { fileExists: existsSync, indexHtml });

warnings.forEach(w => console.warn('Warning: ' + w));
if (errors.length) {
  errors.forEach(e => console.error('Error: ' + e));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`portfolio.json looks good (${items.length} projects).`);
