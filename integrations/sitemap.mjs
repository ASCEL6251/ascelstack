// @ts-check
/**
 * Build-time sitemap.xml generator.
 *
 * After `astro build`, walks the static output directory and lists every
 * prerendered public page (each `.../index.html`). SSR-only routes (dashboard,
 * cart, admin, agreements, login, ...) never reach the output dir, so they are
 * excluded automatically. Pages marked `noindex` and paths in EXCLUDE are
 * skipped too.
 *
 * URLs use a trailing slash to match the `<link rel="canonical">` Astro emits
 * and the URLs Cloudflare serves (no-slash paths 307 to the slash form).
 *
 * `<lastmod>` = latest git commit touching the page source (plus its data
 * files), falling back to the build time when git history is unavailable.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Paths (with trailing slash) that must never appear in the sitemap. */
const EXCLUDE = new Set(['/404/', '/500/']);

/**
 * Public pages rendered on demand (`prerender = false`) that are not in the
 * static output but must still be indexed. Keep in sync with src/pages.
 */
const SSR_PUBLIC = ['/services/'];

/** @type {Array<[RegExp, { priority: string; changefreq: string }]>} */
const RULES = [
  [/^\/$/, { priority: '1.0', changefreq: 'weekly' }],
  [/^\/services\/$/, { priority: '0.9', changefreq: 'weekly' }],
  [/^\/services\/[^/]+\/$/, { priority: '0.8', changefreq: 'monthly' }],
  [/^\/(automation|projects|about|contact)\/$/, { priority: '0.8', changefreq: 'monthly' }],
  [/^\/(privacy|terms)\/$/, { priority: '0.3', changefreq: 'yearly' }],
];
const DEFAULT_RULE = { priority: '0.5', changefreq: 'monthly' };

/** Extra source files whose edits change a route's content. */
const DATA_DEPS = [
  [/^\/services\//, ['src/data/services.json', 'src/data/catalog.ts', 'src/data/pricing.json']],
  [/^\/projects\/$/, ['src/data/projects.ts']],
  [/^\/automation\/$/, ['src/data/workflows.ts']],
  [/^\/$/, ['src/data/catalog.ts', 'src/data/industries.ts']],
];

/** @param {string} dir */
function findHtml(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '_astro') continue;
      out.push(...findHtml(full));
    } else if (name === 'index.html') {
      out.push(full);
    }
  }
  return out;
}

/** @param {string} root @param {string[]} files */
function gitDate(root, files) {
  const existing = files.filter((f) => existsSync(join(root, f)));
  if (!existing.length) return null;
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...existing], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return iso ? iso.slice(0, 10) : null;
  } catch {
    return null;
  }
}

/** Map a URL path to the page source(s) that render it. @param {string} root @param {string} path */
function sourcesFor(root, path) {
  const bare = path.replace(/^\/|\/$/g, '');
  const candidates = bare
    ? [`src/pages/${bare}.astro`, `src/pages/${bare}/index.astro`]
    : ['src/pages/index.astro'];
  const found = candidates.filter((f) => existsSync(join(root, f)));
  if (!found.length) {
    // Dynamic route, e.g. /services/foo/ -> src/pages/services/[slug].astro
    const parent = bare.split('/').slice(0, -1).join('/');
    const dir = join(root, 'src/pages', parent);
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (/^\[.+\]\.astro$/.test(f)) found.push(`src/pages/${parent}/${f}`);
      }
    }
  }
  for (const [re, deps] of DATA_DEPS) if (re.test(path)) found.push(...deps);
  return found;
}

/** @param {string} s */
const xmlEscape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** @returns {import('astro').AstroIntegration} */
export default function sitemap() {
  /** @type {URL | undefined} */
  let site;
  /** @type {string} */
  let root = process.cwd();

  return {
    name: 'ascelstack-sitemap',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site ? new URL(config.site) : undefined;
        root = fileURLToPath(config.root);
      },
      'astro:build:done': ({ dir, logger }) => {
        if (!site) {
          logger.warn('`site` is not set in astro.config — skipping sitemap.xml');
          return;
        }
        const outDir = fileURLToPath(dir);
        const buildDate = new Date().toISOString().slice(0, 10);

        /** @type {Array<{ file: string; path: string }>} */
        const entries = findHtml(outDir)
          .map((file) => {
            const rel = relative(outDir, file).split(sep).join('/');
            const path = '/' + rel.replace(/index\.html$/, '');
            return { file, path };
          })
          .filter(({ path }) => !EXCLUDE.has(path))
          .filter(({ file }) => !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(readFileSync(file, 'utf8')));
        for (const path of SSR_PUBLIC) {
          if (!entries.some((e) => e.path === path)) entries.push({ file: '', path });
        }

        const urls = entries
          .sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)))
          .map(({ path }) => {
            const rule = RULES.find(([re]) => re.test(path))?.[1] ?? DEFAULT_RULE;
            const lastmod = gitDate(root, sourcesFor(root, path)) ?? buildDate;
            const loc = new URL(path, site).href;
            return [
              '  <url>',
              `    <loc>${xmlEscape(loc)}</loc>`,
              `    <lastmod>${lastmod}</lastmod>`,
              `    <changefreq>${rule.changefreq}</changefreq>`,
              `    <priority>${rule.priority}</priority>`,
              '  </url>',
            ].join('\n');
          });

        const xml =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls.join('\n') +
          '\n</urlset>\n';

        writeFileSync(join(outDir, 'sitemap.xml'), xml);
        logger.info(`sitemap.xml written with ${urls.length} URLs`);
      },
    },
  };
}
