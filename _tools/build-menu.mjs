/* Builds the /menu/ page from the "TSK Website Menu" Google Sheet.
 *
 * Reads    the Menu and Sections tabs of the sheet the homepage menu also reads (its id is SHEET_ID in index.html)
 * Writes   menu/index.html   one page with every dish, option, price and diet mark as plain text
 *          menu/menu.css     its styles (copied from _tools/menu.css)
 *          sitemap.xml       the /menu/ entry (its date moves only when the page really changes)
 *
 * Run by .github/workflows/build-blog.yml every 30 minutes, whenever the site is saved, and from the
 * Actions tab with "Run workflow". Safe to run again at any time: the output only depends on the sheet.
 *
 * If something looks wrong with the sheet (a dish with no Type or price, an empty sheet, many dishes gone)
 * it stops BEFORE writing anything and says which row to fix, so the last good page stays live.
 *
 * Usage   node build-menu.mjs                          read the live sheet
 *         node build-menu.mjs --from-file=data.json    read a saved copy: { "menu": {cols, rows}, "sections": {cols, rows} }
 *         node build-menu.mjs --out=some/folder        write menu/ there instead of the site (and leave the sitemap alone)
 * Set MENU_ALLOW_DROP=true to let a build go ahead even though far fewer dishes are showing than before.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BRAND = 'TSK – The Spice Kitchen, Kokapet';
const ORDER_URL = 'https://ownly.food/app/brand/BR443647';
const PHONE = '+91 99490 51777';
const PHONE_HREF = 'tel:+919949051777';
const MIN_DISHES = 30; // fewer dishes than this showing means the sheet is broken
const MAX_DROP = 0.2; // more than a fifth of the dishes vanishing in one go holds the build
const POPULAR_TEXT = 'The dishes our regulars order again and again.';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const txt = (v) => (v == null ? '' : String(v).trim());
const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const money = (n) => '₹' + (Number.isInteger(n) ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n.toFixed(2));
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/* ───────────── reading cells (the same rules the homepage menu uses) ───────────── */
export function num(v) {
  if (typeof v === 'number') return v;
  const s = txt(v).replace(/[\s,₹]|rs\.?|inr/gi, '');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/* "On website" cell: empty means show; FALSE, no, hide... mean hide. */
export function visible(v) {
  if (v == null || v === '') return true;
  if (typeof v === 'boolean') return v;
  return !/^(false|no|n|0|off|hide|hidden)$/i.test(txt(v));
}

/* The Type cell. Unlike the homepage, an empty or unknown Type is an error here (null), never "Veg". */
export function dietOf(v) {
  const s = txt(v).toLowerCase().replace(/[\s_-]+/g, '');
  if (/^(veg|vegetarian|v)$/.test(s)) return 'v';
  if (/^(egg|containsegg|eggetarian|e)$/.test(s)) return 'e';
  if (/^(nonveg|nonvegetarian|nv|n)$/.test(s)) return 'n';
  return null;
}

/* Only photos from the restaurant's Google Drive folder are used (the same ones the homepage shows). */
export function photoId(v) {
  const s = txt(v);
  if (!s) return '';
  const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(s) ? s : '';
}

export function findCols(labels, want) {
  const out = {};
  for (const k of Object.keys(want)) out[k] = labels.findIndex((l) => want[k].test(l));
  return out;
}

const MENU_COLS = {
  section: /^section/, dish: /^dish/, option: /^option/, price: /^price/, type: /^(type|veg|diet)/,
  show: /(website|show|available)/, popular: /^popular/, photo: /^(photo|image|picture)/, desc: /^desc/,
};

/* ───────────── reading the sheet ───────────── */
export function parseGviz(text, tab) {
  let j;
  try { j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch {
    throw new Error(`Google did not send the "${tab}" tab as a table. Is the sheet still shared so that anyone with the link can view it?`);
  }
  if (!j || j.status !== 'ok' || !j.table) {
    const why = (j && j.errors && j.errors[0] && j.errors[0].detailed_message) || (j && j.status) || 'no answer';
    throw new Error(`Google could not read the "${tab}" tab (${why}). Does a tab with exactly that name still exist?`);
  }
  return {
    cols: j.table.cols.map((c) => txt(c.label).toLowerCase()),
    rows: (j.table.rows || []).map((r) => (r.c || []).map((c) => (c == null ? null : c.v != null ? c.v : c.f != null ? c.f : null))),
  };
}

async function fetchTab(sheetId, tab) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(tab)}&t=${Date.now()}`;
      const res = await fetch(url, { headers: { 'user-agent': 'tsk-menu-builder' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`Google answered HTTP ${res.status}`);
      return parseGviz(await res.text(), tab);
    } catch (e) {
      last = e;
      if (attempt < 3) await new Promise((ok) => setTimeout(ok, attempt * 4000));
    }
  }
  throw new Error(`Could not read the "${tab}" tab of the menu sheet. ${last.message}`);
}

/* ───────────── sheet rows → sections and dishes ───────────── */
export function buildModel(menu, sections) {
  const problems = [];
  const warnings = [];
  const empty = { problems, warnings, sections: [], popular: [], counts: { dishes: 0, options: 0, sections: 0, hidden: 0 } };
  const ci = findCols(menu.cols, MENU_COLS);
  for (const [k, label] of [['section', 'Section'], ['dish', 'Dish'], ['price', 'Price'], ['type', 'Type']]) {
    if (ci[k] < 0) problems.push(`The Menu tab has no "${label}" column (columns found: ${menu.cols.filter(Boolean).join(', ') || 'none'}).`);
  }
  if (problems.length) return empty;

  const cats = [];
  const catIx = new Map();
  const cat = (name, desc) => {
    const k = name.toLowerCase();
    if (!catIx.has(k)) { catIx.set(k, cats.length); cats.push({ name, desc: desc || '', dishes: [] }); } else if (desc && !cats[catIx.get(k)].desc) cats[catIx.get(k)].desc = desc;
    return catIx.get(k);
  };
  const inSectionsTab = new Set();
  if (sections) {
    const sc = findCols(sections.cols, { name: /^section/, desc: /^desc/ });
    if (sc.name >= 0) {
      for (const r of sections.rows) {
        const n = txt(r[sc.name]);
        if (n) { cat(n, sc.desc >= 0 ? txt(r[sc.desc]) : ''); inSectionsTab.add(n.toLowerCase()); }
      }
    }
  }

  const byKey = new Map();
  const seenRows = new Set();
  const dishes = [];
  let hidden = 0;
  menu.rows.forEach((r, i) => {
    const rowNo = i + 2; // row 1 of the sheet is the header
    if (r.every((c) => txt(c) === '')) return;
    const cell = (k) => (ci[k] >= 0 ? r[ci[k]] : null);
    if (ci.show >= 0 && !visible(cell('show'))) { hidden++; return; }

    const sec = txt(cell('section'));
    const name = txt(cell('dish'));
    const where = `Menu row ${rowNo}${name ? ` ("${name}")` : ''}`;
    if (!sec) { problems.push(`${where}: the Section is empty.`); return; }
    if (!name) { problems.push(`Menu row ${rowNo} (${sec}): the Dish name is empty.`); return; }
    const price = num(cell('price'));
    const diet = dietOf(cell('type'));
    if (!(price >= 0)) problems.push(`${where}: the Price is empty or not a number.`);
    if (!diet) problems.push(`${where}: the Type is ${txt(cell('type')) ? `"${txt(cell('type'))}"` : 'empty'}. Use Veg, Egg or Non-veg.`);
    if (!(price >= 0) || !diet) return;

    const opt = txt(cell('option'));
    const rowKey = `${sec}|${name}|${opt}`.toLowerCase();
    if (seenRows.has(rowKey)) warnings.push(`${where}: the same dish and option appear twice in ${sec}.`);
    seenRows.add(rowKey);

    const c = cat(sec);
    const key = `${c}|${name.toLowerCase()}`;
    let d = byKey.get(key);
    if (!d) { d = { name, cat: c, photo: '', desc: '', pop: 0, options: [] }; byKey.set(key, d); dishes.push(d); }
    const rawPhoto = txt(cell('photo'));
    const ph = photoId(rawPhoto);
    if (ph && !d.photo) d.photo = ph;
    if (rawPhoto && !ph) warnings.push(`${where}: the Photo is not a Google Drive link, so it was not used.`);
    const ds = txt(cell('desc'));
    if (ds && !d.desc) d.desc = ds;
    const pp = num(cell('popular'));
    if (pp > 0 && !d.pop) d.pop = pp;
    d.options.push({ name: opt, price, diet });
  });

  const used = new Set(['popular', 'notes', 'main', 'top']);
  const unique = (base, fallback) => {
    const root = base || fallback;
    let s = root;
    let n = 2;
    while (used.has(s)) s = `${root}-${n++}`;
    used.add(s);
    return s;
  };
  for (const d of dishes) cats[d.cat].dishes.push(d);
  const live = cats.filter((c) => c.dishes.length);
  for (const c of live) {
    c.slug = unique(slugify(c.name), 'section');
    if (!inSectionsTab.has(c.name.toLowerCase())) warnings.push(`"${c.name}" is on the Menu tab but not on the Sections tab, so it has no description and is listed after the others.`);
  }
  for (const d of dishes) d.id = unique(slugify(d.name), 'dish');

  const popular = dishes.filter((d) => d.pop > 0).sort((a, b) => a.pop - b.pop);
  for (const d of popular) if (!d.photo) warnings.push(`"${d.name}" is marked Popular but has no Google Drive photo.`);

  return {
    problems, warnings, sections: live, popular,
    counts: { dishes: dishes.length, options: dishes.reduce((n, d) => n + d.options.length, 0), sections: live.length, hidden },
  };
}

/* The checks. Anything returned here stops the build, and the last good page stays live. */
export function checkModel(model, { previousDishes = 0, allowDrop = false, minDishes = MIN_DISHES } = {}) {
  const problems = [...model.problems];
  if (problems.length) return problems;
  const n = model.counts.dishes;
  if (n < minDishes) problems.push(`Only ${n} dishes are set to show on the website, which looks like a mistake (the menu page needs at least ${minDishes}).`);
  else if (previousDishes && !allowDrop && n < previousDishes * (1 - MAX_DROP)) {
    problems.push(`The menu page would drop from ${previousDishes} dishes to ${n}, which is more than a fifth fewer. If that is really intended, run the workflow by hand from the Actions tab and tick "Allow a big drop in dishes".`);
  }
  return problems;
}

/* ───────────── the page ───────────── */
const DIET = { v: { word: 'Veg', cls: '' }, e: { word: 'Egg', cls: ' mn-mark--e' }, n: { word: 'Non-veg', cls: ' mn-mark--n' } };
const mark = (t) => `<i class="mn-mark${DIET[t].cls}" aria-hidden="true"></i>`;
const dietLabel = (t) => `<span class="mn-diet">${mark(t)}${DIET[t].word}</span>`;
const mixedDiet = (d) => new Set(d.options.map((o) => o.diet)).size > 1;
const lh = (id, w) => `https://lh3.googleusercontent.com/d/${id}=w${w}-rw`;

function optionRow(o, mixed) {
  let left = esc(o.name);
  if (mixed) {
    const word = DIET[o.diet].word;
    const said = slugify(o.name).replace(/-/g, '') === word.toLowerCase().replace(/-/g, '');
    left = `${mark(o.diet)}<span>${esc(o.name || word)}${said || !o.name ? '' : ` <small>${word}</small>`}</span>`;
  }
  return `<li class="mn-opt"><span class="mn-opt__name">${left}</span><span class="mn-price">${money(o.price)}</span></li>`;
}

function priceBlock(d) {
  const mixed = mixedDiet(d);
  if (d.options.length === 1 && !d.options[0].name) return `<div class="mn-price mn-price--one">${money(d.options[0].price)}</div>`;
  return `<ul class="mn-opts">${d.options.map((o) => optionRow(o, mixed)).join('')}</ul>`;
}

function mainBlock(d) {
  return `<div class="mn-dish__main"><h3 class="mn-dish__name">${esc(d.name)}</h3>${mixedDiet(d) ? '' : dietLabel(d.options[0].diet)}${d.desc ? `<p class="mn-dish__desc">${esc(d.desc)}</p>` : ''}</div>`;
}

const rowHtml = (d) => `<li class="mn-dish${d.options.length > 1 ? ' mn-dish--multi' : ''}" id="${d.id}">${mainBlock(d)}${priceBlock(d)}</li>`;

function cardHtml(d) {
  const img = d.photo
    ? `<img class="mn-card__img" src="${lh(d.photo, 480)}" srcset="${lh(d.photo, 480)} 480w, ${lh(d.photo, 800)} 800w" sizes="(max-width: 720px) 78vw, (max-width: 1000px) 44vw, 260px" width="480" height="360" alt="${esc(d.name)}" loading="lazy" decoding="async">`
    : '';
  return `<li class="mn-card">${img}<div class="mn-card__body">${mainBlock(d)}${priceBlock(d)}</div></li>`;
}

function sectionHtml(s) {
  return `<section class="mn-sec" id="${s.slug}" aria-labelledby="h-${s.slug}">
<h2 id="h-${s.slug}">${esc(s.name)}</h2>${s.desc ? `\n<p class="mn-sec__desc">${esc(s.desc)}</p>` : ''}
<ul class="mn-list">
${s.dishes.map(rowHtml).join('\n')}
</ul>
</section>`;
}

function menuLd(model, url, site) {
  return {
    '@context': 'https://schema.org', '@type': 'Menu', '@id': `${url}#menu`, name: `Menu | ${BRAND}`, url, inLanguage: 'en-IN',
    provider: { '@type': 'Restaurant', name: BRAND, url: `${site}/` },
    hasMenuSection: model.sections.map((s) => ({
      '@type': 'MenuSection', name: s.name, ...(s.desc ? { description: s.desc } : {}), url: `${url}#${s.slug}`,
      hasMenuItem: s.dishes.map((d) => ({
        '@type': 'MenuItem', name: d.name, ...(d.desc ? { description: d.desc } : {}),
        offers: d.options.map((o) => ({ '@type': 'Offer', ...(o.name ? { name: o.name } : {}), price: String(o.price), priceCurrency: 'INR' })),
      })),
    })),
  };
}

export function renderPage(model, { site, iconLinks = '', ogImage = '', hasBlog = false, cssVersion = '0', year = new Date().getFullYear() }) {
  const url = `${site}/menu/`;
  // Apply the approved correction only while the sheet retains the previous wording.
  model = { ...model, sections: model.sections.map((s) =>
    s.name === 'Biryanis' && s.desc === "Fragrant rice layered with meat and whole spices, sealed and slow-cooked on dum. Regular serves one; family packs serve two to three."
      ? { ...s, desc: "Choose vegetarian biryanis with vegetables, paneer or mushrooms, or browse egg, chicken, mutton, prawn and fish options. Regular serves one; family packs serve two to three." } : s) };
  const title = 'Kokapet Menu & Prices | Biryani, Veg & Non-Veg | TSK';
  const description = 'Explore TSK The Spice Kitchen’s menu and prices in Kokapet: vegetarian and non-vegetarian biryanis, Telugu curries, starters and desserts. View dishes and order.';
  const ld = [
    menuLd(model, url, site),
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: 'Menu', item: url },
      ],
    },
  ].map(jsonLd).join('\n');
  const chips = [...(model.popular.length ? [['popular', 'Popular']] : []), ...model.sections.map((s) => [s.slug, s.name])]
    .map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('\n');
  const popular = model.popular.length
    ? `<section class="mn-sec" id="popular" aria-labelledby="h-popular">
<h2 id="h-popular">Popular</h2>
<p class="mn-sec__desc">${POPULAR_TEXT}</p>
<ul class="mn-cards">
${model.popular.map(cardHtml).join('\n')}
</ul>
</section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#240A07">
<link rel="canonical" href="${url}">
${iconLinks}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(ogImage)}">` : '<meta name="twitter:card" content="summary">'}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Guntur:wght@400;500;600;700&family=Rozha+One&display=swap">
<link rel="stylesheet" href="/menu/menu.css?v=${cssVersion}">
${ld}
</head>
<body class="mn-page">
<a class="mn-skip" href="#main">Skip to the menu</a>
<header class="mn-top">
  <div class="mn-top__in">
    <a class="mn-brand" href="/" aria-label="${esc(BRAND)}, home">
      <img src="/tsk-original-logo.webp" width="42" height="42" alt="TSK logo">
      <span><b>The Spice Kitchen</b><small>Kokapet, Hyderabad</small></span>
    </a>
    <nav aria-label="Main">
      <a class="mn-link" href="/">Website</a>
      <a class="mn-link" href="/menu/" aria-current="page">Menu</a>
${hasBlog ? '      <a class="mn-link" href="/blog/">Stories</a>\n' : ''}      <a class="mn-btn" href="${ORDER_URL}" target="_blank" rel="noopener" aria-label="Order on Ownly">Order<span class="mn-opt"> on Ownly</span></a>
    </nav>
  </div>
</header>
<main id="main" data-dishes="${model.counts.dishes}" data-options="${model.counts.options}" data-sections="${model.counts.sections}">
  <div class="mn-wrap">
    <nav class="mn-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Menu</nav>
    <header class="mn-hero">
      <h1>TSK menu in Kokapet</h1>
      <p class="mn-lede">Explore vegetarian and non-vegetarian food at TSK The Spice Kitchen on Gandipet Main Road, Kokapet, Hyderabad. Choose from biryanis, Andhra and Telangana curries, starters, kebabs, Indo-Chinese and desserts. Open every day, 11 AM to 11 PM.</p>
      <div class="mn-acts">
        <a class="mn-btn mn-btn--gold" href="${ORDER_URL}" target="_blank" rel="noopener">Order on Ownly</a>
        <a class="mn-btn mn-btn--line" href="/#reserve">Request a table</a>
        <a class="mn-btn mn-btn--line" href="${PHONE_HREF}">Call ${PHONE}</a>
      </div>
      <p class="mn-key">${dietLabel('v')}${dietLabel('e')}${dietLabel('n')}<span class="mn-key__note">Prices in ₹, taxes extra.</span></p>
    </header>
  </div>
  <nav class="mn-chips" aria-label="Menu sections">
    <div class="mn-chips__in">
${chips}
    </div>
  </nav>
  <div class="mn-wrap">
${popular}
${model.sections.map(sectionHtml).join('\n')}
    <section class="mn-notes" id="notes" aria-labelledby="h-notes">
      <h2 id="h-notes">Good to know</h2>
      <p>Menu prices are in rupees and taxes are extra. Prices and availability can change, and the Ownly app shows the final bill before you pay.</p>
      <p><strong>Food allergy?</strong> Tell your server before you order. If you order on Ownly, call us on <a href="${PHONE_HREF}">${PHONE}</a> as soon as you place it. Please let us know before we start cooking.</p>
    </section>
  </div>
</main>
<footer class="mn-foot">
  <div class="mn-foot__in">
    <div>
      <h2>TSK – The Spice Kitchen</h2>
      <p>Ground Floor, Shop No. 9 &amp; 10, Raichandani Business Bay, Gandipet Main Road, Kokapet, Hyderabad, Telangana 500075</p>
    </div>
    <div>
      <h2>Visit</h2>
      <p>Open every day, 11 AM – 11 PM</p>
      <p>Call <a href="${PHONE_HREF}">${PHONE}</a></p>
    </div>
    <div>
      <h2>Explore</h2>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/#reserve">Reserve a table</a></li>
${hasBlog ? '        <li><a href="/blog/">From Our Kitchen</a></li>\n' : ''}        <li><a href="${ORDER_URL}" target="_blank" rel="noopener">Order on Ownly</a></li>
      </ul>
    </div>
  </div>
  <div class="mn-foot__legal">
    <span>© ${year} ${esc(BRAND)}</span>
    <span>FSSAI Lic. No. 13625010001231</span>
    <span><a href="/privacy.html">Privacy Policy</a></span>
  </div>
</footer>
</body>
</html>
`;
}

/* ───────────── sitemap ───────────── */
/* Adds the /menu/ entry the first time; afterwards its date moves only when the page really changed. */
export function updateSitemap(xml, site, today, changed) {
  const loc = `${site}/menu/`;
  const entry = (date) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  const re = new RegExp(`[ \\t]*<url>\\s*<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?</url>`);
  if (re.test(xml)) return changed ? xml.replace(re, entry(today)) : xml;
  const i = xml.indexOf('</url>'); // right after the homepage entry
  if (i < 0) return xml.replace('</urlset>', `${entry(today)}\n</urlset>`);
  return `${xml.slice(0, i + 6)}\n${entry(today)}${xml.slice(i + 6)}`;
}

/* ───────────── main ───────────── */
async function main() {
  const arg = (name) => {
    const a = process.argv.slice(2).find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : '';
  };
  const fromFile = arg('from-file');
  const outBase = arg('out') ? path.resolve(arg('out')) : ROOT;

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const site = `https://${fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim()}`;
  let data;
  if (fromFile) {
    data = JSON.parse(fs.readFileSync(fromFile, 'utf8'));
  } else {
    const sheetId = (indexHtml.match(/var SHEET_ID = '([\w-]{20,})'/) || [])[1];
    if (!sheetId) throw new Error('Could not find SHEET_ID in index.html.');
    const [menu, sections] = await Promise.all([fetchTab(sheetId, 'Menu'), fetchTab(sheetId, 'Sections')]);
    data = { menu, sections };
  }

  const outDir = path.join(outBase, 'menu');
  const pagePath = path.join(outDir, 'index.html');
  const cssPath = path.join(outDir, 'menu.css');
  const previous = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
  const previousDishes = Number((previous.match(/data-dishes="(\d+)"/) || [])[1]) || 0;

  const model = buildModel(data.menu, data.sections);
  for (const w of model.warnings) console.log(`::warning::${w}`);
  const problems = checkModel(model, { previousDishes, allowDrop: process.env.MENU_ALLOW_DROP === 'true' });
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    console.log('The menu page was NOT updated. The last good version is still live. Fix the sheet and the next run will pick it up.');
    process.exitCode = 1;
    return;
  }

  const css = fs.readFileSync(path.join(HERE, 'menu.css'), 'utf8');
  const html = renderPage(model, {
    site,
    iconLinks: [/<link rel="icon"[^>]*>/, /<link rel="apple-touch-icon"[^>]*>/].map((re) => (indexHtml.match(re) || [''])[0]).filter(Boolean).join('\n'),
    ogImage: (indexHtml.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '',
    hasBlog: fs.existsSync(path.join(ROOT, 'blog', 'index.html')),
    cssVersion: sha(css).slice(0, 8),
  });

  fs.mkdirSync(outDir, { recursive: true });
  const changed = html !== previous;
  if (changed) fs.writeFileSync(pagePath, html);
  if (!fs.existsSync(cssPath) || fs.readFileSync(cssPath, 'utf8') !== css) fs.writeFileSync(cssPath, css);

  if (!arg('out')) {
    let today;
    try { today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); } catch { today = new Date().toISOString().slice(0, 10); }
    const smPath = path.join(ROOT, 'sitemap.xml');
    const xml = fs.readFileSync(smPath, 'utf8');
    const next = updateSitemap(xml, site, today, changed);
    if (next !== xml) fs.writeFileSync(smPath, next);
  }

  const { dishes, options, sections, hidden } = model.counts;
  console.log(`Menu page ${changed ? 'built' : 'unchanged'}: ${dishes} dishes, ${options} options, ${sections} sections${hidden ? `, ${hidden} rows hidden from the website` : ''}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.log(`::error::${e.message}`);
    console.log('The menu page was NOT updated. The last good version is still live.');
    process.exitCode = 1;
  });
}
