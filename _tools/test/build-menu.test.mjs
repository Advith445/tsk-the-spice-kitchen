/* Checks for _tools/build-menu.mjs. Run with:  cd _tools && npm test
 * They use a small made-up copy of the sheet, never the live one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { num, visible, dietOf, photoId, parseGviz, buildModel, checkModel, renderPage, updateSitemap } from '../build-menu.mjs';

const MENU_COLS = ['Section', 'Dish', 'Option', 'Price (₹)', 'Type', 'On website', 'Popular order', 'Photo (Google Drive link)', 'Description', 'Item code'];
const SECTION_COLS = ['Section', 'Description shown under the heading'];
const PHOTO = 'https://drive.google.com/file/d/1WBZjdvWc4yfoIk3V089dYuaG7w3g5cqq/view';

/* The sheet as Google sends it (gviz): numbers and booleans carry a real value "v" and a shown text "f". */
function gviz(cols, rows) {
  const cell = (v) => (v === '' || v == null ? null : typeof v === 'number' ? { v, f: `₹${v}` } : typeof v === 'boolean' ? { v, f: v ? 'TRUE' : 'FALSE' } : { v });
  return `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
    version: '0.6', reqId: '0', status: 'ok',
    table: { cols: cols.map((label, i) => ({ id: String.fromCharCode(65 + i), label, type: 'string' })), rows: rows.map((r) => ({ c: r.map(cell) })) },
  })});`;
}
const row = (section, dish, option, price, type, show = true, pop = '', photo = '', desc = '', code = '') => [section, dish, option, price, type, show, pop, photo, desc, code];

const MENU_ROWS = [
  row('Biryanis', 'Veg Biryani', 'Regular', 319, 'Veg'),
  row('Biryanis', 'Veg Biryani', 'Family', 629, 'Veg'),
  row('Biryanis', 'Chicken Dum Biryani', 'Regular', 389, 'Non-veg', true, '', PHOTO, 'Basmati layered over marinated chicken. Served with raita and salan.'),
  row('Biryanis', 'TSK Boneless Biryani', 'Regular', 449, 'Non-veg', true, 1, PHOTO, "Our house biryani with boneless chicken."),
  row('Biryanis', 'Mutton Biryani', 'Family', '₹1,099', 'Non-veg'),
  row('Non-veg starters', 'Chitti Garelu & Natu Kodi Shorba', '', 399, 'Non-veg'),
  row('Veg starters', 'Chitti Garelu', 'Plain', 199, 'Veg', true, 10, PHOTO),
  row('Veg starters', 'Chitti Garelu', 'Tomato', 299, 'Veg'),
  row('Noodles & fried rice', 'Noodles', 'Veg', 299, 'Veg'),
  row('Noodles & fried rice', 'Noodles', 'Egg', 319, 'Egg'),
  row('Noodles & fried rice', 'Noodles', 'Chicken', 349, 'Non-veg'),
  row('Noodles & fried rice', 'Mixed Fried Rice', 'Veg', 299, 'Veg'),
  row('Noodles & fried rice', 'Mixed Fried Rice', 'Non-Veg', 399, 'Non-veg'),
  row('Rice specials', 'Sambar Rice', 'Plain', 299, 'Veg'),
  row('Rice specials', 'Sambar Rice', 'Chicken', 349, 'Non-veg'),
  row('Desserts', 'Apricot Delight', 'Small', 99, 'Veg', true, 12, PHOTO),
  row('Desserts', 'Apricot Delight', 'Large', 199, 'Veg'),
  row('Desserts', 'Hidden Test Dish', '', '', '', false),
  row('Drinks', 'Water Bottle', '', 25, 'Veg'),
  ['', '', '', '', '', '', '', '', '', ''],
];
const SECTION_ROWS = [
  ['Biryanis', 'Fragrant rice layered with meat and whole spices.'],
  ['Non-veg starters', 'Telugu fries and roasts.'],
  ['Veg starters', 'Fresh vegetables, paneer and mushrooms.'],
  ['Noodles & fried rice', 'Wok-tossed noodles and fried rice.'],
  ['Rice specials', 'Comforting rice plates.'],
  ['Desserts', 'Something sweet to finish.'],
  ['Drinks', 'Goli soda, fresh lime soda and more.'],
];
const sheet = (menuRows = MENU_ROWS) => ({ menu: parseGviz(gviz(MENU_COLS, menuRows), 'Menu'), sections: parseGviz(gviz(SECTION_COLS, SECTION_ROWS), 'Sections') });
const build = (menuRows) => { const s = sheet(menuRows); return buildModel(s.menu, s.sections); };

test('reads prices, flags and diets the way the homepage does', () => {
  assert.equal(num(319), 319);
  assert.equal(num('₹1,099'), 1099);
  assert.equal(num('Rs. 250'), 250);
  assert.ok(Number.isNaN(num('')));
  assert.ok(Number.isNaN(num('free')));
  assert.equal(visible(true), true);
  assert.equal(visible(''), true);
  assert.equal(visible(false), false);
  assert.equal(visible('FALSE'), false);
  assert.equal(visible('no'), false);
  assert.equal(dietOf('Veg'), 'v');
  assert.equal(dietOf('Non-Veg'), 'n');
  assert.equal(dietOf('non veg'), 'n');
  assert.equal(dietOf('Egg'), 'e');
  assert.equal(photoId(PHOTO), '1WBZjdvWc4yfoIk3V089dYuaG7w3g5cqq');
  assert.equal(photoId('https://example.com/pic.jpg'), '');
});

test('an empty Type is an error, never quietly Veg', () => {
  assert.equal(dietOf(''), null);
  assert.equal(dietOf(null), null);
  assert.equal(dietOf('Chicken'), null);
  const model = build([...MENU_ROWS, row('Biryanis', 'Fish Biryani', 'Regular', 429, '')]);
  const problems = checkModel(model);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Menu row 22 \("Fish Biryani"\)/);
  assert.match(problems[0], /Type is empty/);
});

test('a missing or non-numeric price stops the build and names the row', () => {
  for (const bad of ['', 'ask us']) {
    const problems = checkModel(build([...MENU_ROWS, row('Biryanis', 'Fish Biryani', 'Regular', bad, 'Non-veg')]));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Menu row 22/);
    assert.match(problems[0], /Price/);
  }
});

test('rows hidden with On website = FALSE are left out and not checked', () => {
  const model = build();
  assert.equal(model.counts.hidden, 1);
  assert.ok(!model.sections.flatMap((s) => s.dishes).some((d) => d.name === 'Hidden Test Dish'));
  assert.deepEqual(checkModel(model, { minDishes: 5 }), []);
});

test('groups options into dishes and dishes into sections in sheet order', () => {
  const model = build();
  assert.deepEqual(model.sections.map((s) => s.name), ['Biryanis', 'Non-veg starters', 'Veg starters', 'Noodles & fried rice', 'Rice specials', 'Desserts', 'Drinks']);
  assert.equal(model.counts.dishes, 11);
  assert.equal(model.counts.options, 18);
  const noodles = model.sections[3].dishes.find((d) => d.name === 'Noodles');
  assert.deepEqual(noodles.options.map((o) => [o.name, o.price, o.diet]), [['Veg', 299, 'v'], ['Egg', 319, 'e'], ['Chicken', 349, 'n']]);
  assert.equal(model.sections[0].dishes.find((d) => d.name === 'Mutton Biryani').options[0].price, 1099);
  assert.deepEqual(model.popular.map((d) => d.name), ['TSK Boneless Biryani', 'Chitti Garelu', 'Apricot Delight']);
});

test('too few dishes, or a big drop since the last build, holds the build', () => {
  const model = build();
  assert.equal(checkModel(model).length, 1); // 11 dishes is under the default minimum of 30
  assert.deepEqual(checkModel(model, { minDishes: 5, previousDishes: 11 }), []);
  assert.deepEqual(checkModel(model, { minDishes: 5, previousDishes: 13 }), []); // 11 is within a fifth of 13
  const drop = checkModel(model, { minDishes: 5, previousDishes: 20 });
  assert.equal(drop.length, 1);
  assert.match(drop[0], /drop from 20 dishes to 11/);
  assert.deepEqual(checkModel(model, { minDishes: 5, previousDishes: 20, allowDrop: true }), []);
});

test('a sheet that Google will not show as a table fails with a plain message', () => {
  assert.throws(() => parseGviz('<html>Sign in</html>', 'Menu'), /shared so that anyone with the link can view it/);
  assert.throws(() => parseGviz('google.visualization.Query.setResponse({"status":"error","errors":[{"detailed_message":"Invalid sheet"}]});', 'Menu'), /Invalid sheet/);
});

test('the page has every dish and option as text, escaped, with working jump links', () => {
  const model = build();
  const html = renderPage(model, { site: 'https://example.test', hasBlog: true, cssVersion: 'abc12345', year: 2026 });
  assert.match(html, /<h1>TSK menu in Kokapet<\/h1>/);
  assert.match(html, /<title>Menu &amp; prices – TSK The Spice Kitchen, Kokapet<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.test\/menu\/">/);
  assert.match(html, /Chitti Garelu &amp; Natu Kodi Shorba/);
  assert.match(html, /<main id="main" data-dishes="11" data-options="18" data-sections="7">/);
  assert.match(html, /₹1,099/);
  assert.match(html, /<a class="mn-link" href="\/blog\/">Stories<\/a>/);
  assert.ok(!/Hidden Test Dish/.test(html));
  // the sheet's text can never inject markup
  const nasty = build([...MENU_ROWS, row('Drinks', 'Soda <img src=x onerror=alert(1)>', '', 50, 'Veg', true, '', '', 'He said "hi" & left')]);
  const nastyHtml = renderPage(nasty, { site: 'https://example.test' });
  assert.ok(!/<img src=x/.test(nastyHtml));
  assert.match(nastyHtml, /Soda &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(nastyHtml, /He said &quot;hi&quot; &amp; left/);
  // every jump link lands on an element
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), `no element with id ${id}`);
  // ids are unique
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('mixed-diet dishes show a mark and a word on every option; single-diet dishes once', () => {
  const html = renderPage(build(), { site: 'https://example.test' });
  const dish = (id) => {
    const start = html.indexOf(`<li class="mn-dish mn-dish--multi" id="${id}">`);
    assert.ok(start >= 0, `no dish ${id}`);
    const next = html.indexOf('<li class="mn-dish', start + 10);
    return html.slice(start, next < 0 ? html.indexOf('</section>', start) : next);
  };
  const noodles = dish('noodles');
  assert.match(noodles, /mn-mark--e/);
  assert.match(noodles, /mn-mark--n/);
  assert.match(noodles, /Chicken <small>Non-veg<\/small>/);
  assert.ok(!/class="mn-diet"/.test(noodles)); // no dish-level label when the options differ
  const mixedFriedRice = dish('mixed-fried-rice');
  assert.match(mixedFriedRice, /<span>Non-Veg<\/span>/); // the option already says it, so the word is not repeated
  assert.ok(!/<small>/.test(mixedFriedRice));
  const veg = dish('veg-biryani');
  assert.equal((veg.match(/class="mn-diet"/g) || []).length, 1);
  assert.ok(!/mn-mark--[en]/.test(veg));
});

test('the structured data is valid JSON and matches what is on the page', () => {
  const model = build();
  const html = renderPage(model, { site: 'https://example.test' });
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const menu = blocks.find((b) => b['@type'] === 'Menu');
  assert.equal(menu.hasMenuSection.length, 7);
  const items = menu.hasMenuSection.flatMap((s) => s.hasMenuItem);
  assert.equal(items.length, model.counts.dishes);
  assert.equal(items.flatMap((i) => i.offers).length, model.counts.options);
  assert.deepEqual(items.find((i) => i.name === 'Veg Biryani').offers, [
    { '@type': 'Offer', name: 'Regular', price: '319', priceCurrency: 'INR' },
    { '@type': 'Offer', name: 'Family', price: '629', priceCurrency: 'INR' },
  ]);
  assert.ok(blocks.some((b) => b['@type'] === 'BreadcrumbList'));
  assert.ok(!('suitableForDiet' in items[0])); // diet marks are shown as words only; no dietary claims in the data
});

test('popular dishes get a lazy photo from Google Drive; ordinary dishes get none', () => {
  const html = renderPage(build(), { site: 'https://example.test' });
  const cards = html.match(/<ul class="mn-cards">[\s\S]*?<\/ul>\s*<\/section>/)[0];
  assert.equal((cards.match(/<li class="mn-card">/g) || []).length, 3);
  assert.equal((cards.match(/loading="lazy"/g) || []).length, 3);
  assert.match(cards, /https:\/\/lh3\.googleusercontent\.com\/d\/1WBZjdvWc4yfoIk3V089dYuaG7w3g5cqq=w480-rw/);
  const rest = html.slice(html.indexOf('id="biryanis"'));
  assert.ok(!/<img/.test(rest.slice(0, rest.indexOf('</main>'))));
});

test('the sitemap gets the /menu/ entry once, and its date moves only when the page changed', () => {
  const base = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.test/</loc>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://example.test/blog/</loc>\n    <lastmod>2026-11-07</lastmod>\n  </url>\n</urlset>\n';
  const first = updateSitemap(base, 'https://example.test', '2026-11-08', true);
  assert.match(first, /<loc>https:\/\/example\.test\/<\/loc>[\s\S]*?<\/url>\n  <url>\n    <loc>https:\/\/example\.test\/menu\/<\/loc>\n    <lastmod>2026-11-08<\/lastmod>/);
  assert.equal((first.match(/\/menu\//g) || []).length, 1);
  assert.match(first, /<loc>https:\/\/example\.test\/blog\/<\/loc>/);
  assert.equal(updateSitemap(first, 'https://example.test', '2026-11-20', false), first); // no change, no new date
  const moved = updateSitemap(first, 'https://example.test', '2026-11-20', true);
  assert.match(moved, /\/menu\/<\/loc>\n    <lastmod>2026-11-20<\/lastmod>/);
  assert.equal((moved.match(/\/menu\//g) || []).length, 1);
  // the blog builder removes and re-adds only /blog/ entries, so it leaves this one alone
  const withoutBlog = first.replace(/\s*<url>\s*<loc>[^<]*\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  assert.match(withoutBlog, /\/menu\//);
});

test('building twice from the same sheet gives byte-identical pages', () => {
  const ctx = { site: 'https://example.test', cssVersion: 'abc12345', year: 2026 };
  assert.equal(renderPage(build(), ctx), renderPage(build(), ctx));
});
