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

// ---------------------------------------------------------------------------
// Pricing: data/pricing.csv ("Price List" tab) + data/packages.csv
// ("Development Packages" tab) from SSTech_Price_List_v2.xlsx.
// To update prices: export both tabs from the spreadsheet as CSV over these
// files, then run `npm run data`.
// ---------------------------------------------------------------------------

const readRows = (file) => {
  const [h, ...b] = parseCSV(readFileSync(resolve(root, file), 'utf8').replace(/^﻿/, ''));
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] ?? '').trim()])));
};
const num = (v) => (v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
// pricing.json ships to the browser, so internal sales notes and competitor
// names from the sheet must not end up in it. Notes are split on ';' and only
// customer-facing parts (extra costs, govt fees, billing terms) are kept.
const INTERNAL = /margin|lead magnet|retention|junk|gap|\bsell\b|pitch|promote|best (entry|recurring)|duplicate|partner with|needs studio|fixed scope preferred|usually bundled|phase 2|hot demand|zolvit|indiafilings|ebizfiling|incorpx|upgrowth|micro-creators|same packages as/i;
const COMPETITOR = /\b(zolvit|indiafilings|ebizfiling|incorpx|upgrowth)\b/i;
const publicNote = (note) =>
  (note ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter((x) => x && !INTERNAL.test(x))
    .join('; ');
const publicMarket = (m) =>
  (m ?? '')
    .replace(/\s*\([^)]*\)/g, (g) => (COMPETITOR.test(g) ? '' : g))
    .split(/\s*[·;]\s*/)
    .filter((x) => x && !COMPETITOR.test(x))
    .join(' · ');

const TYPE = { 'Package (5 options)': 'package', 'Fixed price': 'fixed', 'Starting price': 'starting' };

const packagesById = {};
for (const p of readRows('data/packages.csv')) {
  const isCustom = p['Package'] === 'Custom';
  (packagesById[p['Service ID']] ??= []).push({
    key: isCustom ? 'custom' : p['Package'].replace(/^\d+\.\s*/, '').toLowerCase(),
    name: p['Package'].replace(/^\d+\.\s*/, ''),
    price: num(p['Price (₹)']),
    includes: p['What you get'],
    delivery: p['Delivery time'],
    notes: publicNote(p['Notes']),
  });
}

const pricing = {};
for (const r of readRows('data/pricing.csv')) {
  const id = r['Service ID'];
  const sp = r['Price Tag — Small Business (₹)'];
  const mp = r['Price Tag — Mid-size Business (₹)'];
  pricing[id] = {
    id,
    status: r['Status'] === 'Open' ? 'open' : 'soon',
    type: TYPE[r['Pricing Type']] ?? 'starting',
    small: { price: num(sp), text: num(sp) === null ? sp : '', unit: r['Unit — Small Business'], detail: r['Small Business Price (detail)'] },
    mid: { price: num(mp), text: num(mp) === null ? mp : '', unit: r['Unit — Mid-size Business'], detail: r['Mid-size Price (detail)'] },
    billing: r['Billing Model'],
    market: publicMarket(r['India Market Rate (₹) — 2026']),
    notes: publicNote(r['Notes / Extra Costs / Benchmarks']),
    ...(packagesById[id] ? { packages: packagesById[id] } : {}),
  };
}

const missing = services.filter((s) => !pricing[s.id]).map((s) => s.id);
if (missing.length) console.warn(`No price for: ${missing.join(', ')}`);
writeFileSync(resolve(root, 'src/data/pricing.json'), JSON.stringify(pricing, null, 2) + '\n');
console.log(`Wrote ${Object.keys(pricing).length} prices to src/data/pricing.json`);
