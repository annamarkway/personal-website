// Checks portfolio.json for mistakes that would break the Portfolio page.
// Run locally with: node scripts/check-portfolio.mjs
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const warnings = [];

let items;
try {
  items = JSON.parse(readFileSync('portfolio.json', 'utf8'));
} catch (err) {
  console.error('portfolio.json is not valid JSON: ' + err.message);
  console.error('(Common causes: a missing or extra comma, or an unescaped quote inside a string.)');
  process.exit(1);
}

if (!Array.isArray(items)) {
  console.error('portfolio.json must be a list of projects: [ {...}, {...} ]');
  process.exit(1);
}

const isString = v => typeof v === 'string' && v.trim() !== '';
const isStringList = v => Array.isArray(v) && v.every(isString);
const ids = new Set();
const employers = new Set();

items.forEach((p, i) => {
  const where = `Project #${i + 1}` + (p && p.id ? ` ("${p.id}")` : '');
  if (!p || typeof p !== 'object') { errors.push(`${where}: is not an object`); return; }

  for (const field of ['id', 'title', 'context', 'short_description', 'long_description', 'date']) {
    if (!isString(p[field])) errors.push(`${where}: "${field}" is missing or empty`);
  }
  if (!isStringList(p.tags)) errors.push(`${where}: "tags" must be a list of text values`);
  if (!isStringList(p.tech_stack)) errors.push(`${where}: "tech_stack" must be a list of text values`);
  if (typeof p.impact_score !== 'number') errors.push(`${where}: "impact_score" must be a number`);

  if (isString(p.date) && (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || isNaN(new Date(p.date + 'T00:00:00')))) {
    errors.push(`${where}: "date" must look like 2026-08-01`);
  }
  if (isString(p.id)) {
    if (ids.has(p.id)) errors.push(`${where}: id "${p.id}" is used more than once`);
    ids.add(p.id);
  }

  if ('employer' in p) {
    if (!isString(p.employer)) errors.push(`${where}: "employer" must be text`);
    else employers.add(p.employer);
  }
  if ('featured' in p && typeof p.featured !== 'boolean') errors.push(`${where}: "featured" must be true or false (no quotes)`);
  if ('result' in p && !isString(p.result)) errors.push(`${where}: "result" must be text`);
  if ('status' in p && !isString(p.status)) errors.push(`${where}: "status" must be text`);

  if ('attachments' in p) {
    if (!Array.isArray(p.attachments)) errors.push(`${where}: "attachments" must be a list`);
    else p.attachments.forEach((a, j) => {
      if (!a || !isString(a.name) || !isString(a.url)) {
        errors.push(`${where}: attachment #${j + 1} needs a "name" and a "url"`);
      } else if (!/^https?:\/\//.test(a.url) && !existsSync(a.url)) {
        errors.push(`${where}: attachment file "${a.url}" doesn't exist`);
      }
    });
  }
});

// Links on the homepage should point at projects and employers that exist.
if (existsSync('index.html')) {
  const html = readFileSync('index.html', 'utf8');
  for (const [, key] of html.matchAll(/portfolio\.html\?employer=([^"&#]+)/g)) {
    if (!employers.has(decodeURIComponent(key))) errors.push(`index.html links to employer "${key}", but no project has that "employer"`);
  }
  for (const [, key] of html.matchAll(/portfolio\.html\?project=([^"&#]+)/g)) {
    if (!ids.has(decodeURIComponent(key))) errors.push(`index.html links to project "${key}", which doesn't exist`);
  }
}

const featured = items.filter(p => p && p.featured === true).length;
if (featured > 0 && featured !== 3) warnings.push(`${featured} projects are marked "featured"; the homepage grid is designed for 3`);

warnings.forEach(w => console.warn('Warning: ' + w));
if (errors.length) {
  errors.forEach(e => console.error('Error: ' + e));
  console.error(`\n${errors.length} problem(s) found in portfolio.json.`);
  process.exit(1);
}
console.log(`portfolio.json looks good (${items.length} projects).`);
