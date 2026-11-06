// Converts data/services.csv into src/data/services.json.
// Run with: npm run data
//
// Note: the source CSV's category_id column is off by one on the last row of
// each category, so categories are keyed by their name, not category_id.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'data/services.csv'), 'utf8');

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const [header, ...body] = parseCSV(src);
const services = body.map((r) => {
  const o = Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()]));
  return {
    id: o.service_id,
    category: o.category,
    subcategory: o.subcategory === 'General' || o.subcategory === 'Future Expansion' ? '' : o.subcategory,
    name: o.service,
    description: o.description,
    priority: o.launch_priority === 'Future' ? 'future' : 'core',
    notes: o.notes,
  };
});

writeFileSync(resolve(root, 'src/data/services.json'), JSON.stringify(services, null, 2) + '\n');
console.log(`Wrote ${services.length} services to src/data/services.json`);
