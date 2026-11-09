/* Builds the "From Our Kitchen" blog.
 *
 * Reads    _blog/posts/*.md    (written in the blog editor; title, photo, text, optional video)
 *          _blog/media/*       (photos uploaded in the editor)
 * Writes   blog/               one page per published post, the blog index, resized photos, styles
 *          index.html          the "From Our Kitchen" cards (BLOG markers) and the "Stories" menu links (BLOG-NAV, BLOG-SHEET)
 *          sitemap.xml         the blog entries
 *
 * Run by .github/workflows/build-blog.yml whenever a post is saved. Safe to run again at any time:
 * the output only depends on what is in _blog/.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import YAML from 'yaml';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, '_blog', 'posts');
const MEDIA_DIR = path.join(ROOT, '_blog', 'media');
const OUT = path.join(ROOT, 'blog');
const SITE = 'https://' + fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim();
const BRAND = 'TSK – The Spice Kitchen, Kokapet';
const ORDER_URL = 'https://ownly.food/app/brand/BR443647';
const PHONE = '+91 99490 51777';
const HOME_CARDS = 3;

const warn = (msg) => console.log(`::warning::${msg}`);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/* ───────────── reading posts ───────────── */
function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const posts = [];
  for (const file of fs.readdirSync(POSTS_DIR).filter((f) => f.toLowerCase().endsWith('.md')).sort()) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8').replace(/^\uFEFF/, '');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) { warn(`${file}: no title/details block at the top, so the post was skipped.`); continue; }
    let data;
    try { data = YAML.parse(m[1]) || {}; } catch (e) { warn(`${file}: could not read the post details (${e.message.split('\n')[0]}), so the post was skipped.`); continue; }
    if (!(data.published === true || String(data.published).toLowerCase() === 'true')) continue;

    const slug = slugify(path.basename(file, path.extname(file)));
    const title = String(data.title ?? '').trim();
    const dm = String(data.date instanceof Date ? data.date.toISOString() : data.date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    const cover = String(data.cover ?? '').trim();
    const body = m[2].trim();
    const problems = [];
    if (!slug) problems.push('the file name has no usable letters or numbers');
    if (!title) problems.push('it has no title');
    if (!dm) problems.push('it has no date');
    if (!cover) problems.push('it has no cover photo');
    if (!body) problems.push('it has no text');
    if (problems.length) { warn(`${file}: skipped because ${problems.join(', ')}.`); continue; }

    const plain = body.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|-]/g, ' ').replace(/\s+/g, ' ').trim();
    let description = String(data.description ?? '').replace(/\s+/g, ' ').trim();
    if (!description) { description = plain.slice(0, 155).replace(/\s+\S*$/, '') + '…'; warn(`${file}: no short description, so one was made from the first lines of the post.`); }

    posts.push({
      file, slug, title, description, body,
      date: `${dm[1]}-${dm[2]}-${dm[3]}`,
      cover, coverAlt: String(data.cover_alt ?? '').trim() || title,
      video: String(data.video ?? '').trim(),
      minutes: Math.max(1, Math.round(plain.split(' ').length / 200)),
    });
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
  return posts;
}

const niceDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/* ───────────── photos ───────────── */
const imgCache = new Map();
function findMedia(src) {
  if (!src || /^(https?:)?\/\//i.test(src)) return null;
  let p;
  try { p = decodeURIComponent(src.split('#')[0].split('?')[0]); } catch { p = src; }
  p = p.replace(/^\/+/, '').replace(/^(_?blog\/)?media\//, '');
  for (const rel of [p, path.basename(p)]) {
    const f = path.resolve(MEDIA_DIR, rel);
    if (f.startsWith(MEDIA_DIR + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

/* Resizes a photo into a few web-sized versions so pages load fast on phones. */
async function processImage(src) {
  const file = findMedia(src);
  if (!file) return null;
  if (imgCache.has(file)) return imgCache.get(file);
  const buf = fs.readFileSync(file);
  const hash = sha(buf).slice(0, 8);
  const base = slugify(path.basename(file, path.extname(file))) || 'photo';
  let result;
  if (path.extname(file).toLowerCase() === '.gif') {
    const name = `${base}-${hash}.gif`;
    fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'img', name), buf);
    const meta = await sharp(buf).metadata();
    result = { src: `/blog/img/${name}`, srcset: '', width: meta.width, height: meta.pageHeight || meta.height, ogFile: null };
  } else {
    const { data, info } = await sharp(buf, { failOn: 'none' }).rotate().toBuffer({ resolveWithObject: true });
    let widths = [480, 800, 1200, 1600].filter((w) => w <= info.width);
    if (!widths.length) widths = [info.width];
    const variants = [];
    fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
    for (const w of widths) {
      const out = await sharp(data).resize({ width: w }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
      const name = `${base}-${hash}-${w}.webp`;
      fs.writeFileSync(path.join(OUT, 'img', name), out.data);
      variants.push({ w: out.info.width, h: out.info.height, url: `/blog/img/${name}` });
    }
    const main = [...variants].reverse().find((v) => v.w <= 1200) || variants[0];
    const ogName = `${base}-${hash}-share.jpg`;
    await sharp(data).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toFile(path.join(OUT, 'img', ogName));
    result = { src: main.url, srcset: variants.map((v) => `${v.url} ${v.w}w`).join(', '), width: main.w, height: main.h, ogFile: `/blog/img/${ogName}` };
  }
  imgCache.set(file, result);
  return result;
}

const imgTag = (info, alt, sizes, extra = '') =>
  `<img src="${info.src}"${info.srcset ? ` srcset="${info.srcset}" sizes="${sizes}"` : ''} width="${info.width}" height="${info.height}" alt="${esc(alt)}" ${extra}>`;

/* ───────────── videos ───────────── */
function parseVideo(url) {
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/))) return { kind: 'youtube', id: m[1] };
  if ((m = url.match(/instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_-]+)/))) return { kind: 'instagram', type: m[1], id: m[2] };
  return null;
}
function videoHtml(v) {
  const youtube = v.kind === 'youtube';
  const href = youtube ? `https://www.youtube.com/watch?v=${v.id}` : `https://www.instagram.com/${v.type}/${v.id}/`;
  return `<figure class="bl-video bl-video--${v.kind}" data-kind="${v.kind}" data-id="${esc(v.id)}" data-type="${esc(v.type || '')}">` +
    `<a class="bl-video__btn" href="${href}" target="_blank" rel="noopener"><span class="bl-video__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>` +
    `<span class="bl-video__label">Watch the video<small>Plays from ${youtube ? 'YouTube' : 'Instagram'}</small></span></a></figure>`;
}
const VIDEO_SCRIPT = `<script>
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('.bl-video__btn');
  if (!a) return;
  var f = a.parentNode, id = f.getAttribute('data-id'), yt = f.getAttribute('data-kind') === 'youtube';
  var i = document.createElement('iframe');
  i.src = yt ? 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0' : 'https://www.instagram.com/' + (f.getAttribute('data-type') || 'reel') + '/' + id + '/embed';
  i.title = 'Video';
  i.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  i.allowFullscreen = true;
  i.referrerPolicy = 'strict-origin-when-cross-origin';
  f.textContent = '';
  f.appendChild(i);
  e.preventDefault();
});
</script>`;

/* ───────────── post text (markdown → HTML) ───────────── */
function cleanHtml(s) {
  return s.replace(/<\/?(script|style|iframe|object|embed|form|link|meta)\b[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

async function renderBody(body) {
  const flags = { video: false };
  const images = new Map();
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading({ tokens, depth }) { const n = depth <= 2 ? 2 : Math.min(depth, 4); return `<h${n}>${this.parser.parseInline(tokens)}</h${n}>\n`; },
      paragraph({ tokens }) {
        if (tokens.length === 1 && tokens[0].type === 'link') {
          const v = parseVideo(tokens[0].href);
          if (v) { flags.video = true; return videoHtml(v) + '\n'; }
        }
        if (tokens.length === 1 && tokens[0].type === 'image') return this.parser.parseInline(tokens) + '\n';
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
      },
      link({ href, title, tokens }) {
        const safe = /^\s*javascript:/i.test(href) ? '#' : href;
        const external = /^https?:\/\//i.test(safe) && !safe.includes(SITE.replace('https://', ''));
        return `<a href="${esc(safe)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, title, text }) {
        const info = images.get(href);
        const cap = title ? `<figcaption>${esc(title)}</figcaption>` : '';
        if (!info) return `<figure><img src="${esc(href)}" alt="${esc(text)}" loading="lazy" decoding="async">${cap}</figure>`;
        return `<figure>${imgTag(info, text, '(max-width: 760px) 100vw, 720px', 'loading="lazy" decoding="async"')}${cap}</figure>`;
      },
      html({ text }) { return cleanHtml(text); },
    },
  });
  const tokens = md.lexer(body);
  const pending = [];
  md.walkTokens(tokens, (t) => { if (t.type === 'image') pending.push(t.href); });
  for (const href of new Set(pending)) {
    const info = await processImage(href);
    if (info) images.set(href, info); else if (!/^https?:/i.test(href)) warn(`A photo in a post could not be found: ${href}`);
  }
  const html = md.parser(tokens).replace(/<table>/g, '<div class="bl-table"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, hasVideo: flags.video };
}

/* ───────────── page pieces ───────────── */
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const iconLinks = [/<link rel="icon"[^>]*>/, /<link rel="apple-touch-icon"[^>]*>/].map((re) => (indexHtml.match(re) || [''])[0]).join('\n');
const cssVersion = sha(fs.readFileSync(path.join(import.meta.dirname, 'blog.css'))).slice(0, 8);

const head = ({ title, description, canonical, image, type = 'website', extra = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#240A07">
<link rel="canonical" href="${canonical}">
${iconLinks}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${SITE}${image}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${SITE}${image}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Guntur:wght@400;500;600;700&family=Rozha+One&display=swap">
<link rel="stylesheet" href="/blog/blog.css?v=${cssVersion}">
${extra}
</head>
<body class="bl-page">
<a class="bl-skip" href="#main">Skip to the story</a>
<header class="bl-top">
  <div class="bl-top__in">
    <a class="bl-brand" href="/" aria-label="${esc(BRAND)}, home">
      <img src="/tsk-original-logo.webp" width="42" height="42" alt="TSK logo">
      <span><b>The Spice Kitchen</b><small>Kokapet, Hyderabad</small></span>
    </a>
    <nav aria-label="Main">
      <a class="bl-link" href="/">Website</a>
      <a class="bl-link" href="/menu/">Menu</a>
      <a class="bl-link" href="/blog/">Stories</a>
      <a class="bl-btn" href="${ORDER_URL}" target="_blank" rel="noopener">Order on Ownly</a>
    </nav>
  </div>
</header>
`;

const foot = (withVideo) => `<footer class="bl-foot">
  <div class="bl-foot__in">
    <div>
      <h2>TSK – The Spice Kitchen</h2>
      <p>Ground Floor, Shop No. 9 &amp; 10, Raichandani Business Bay, Gandipet Main Road, Kokapet, Hyderabad, Telangana 500075</p>
    </div>
    <div>
      <h2>Visit</h2>
      <p>Open every day, 11 AM – 11 PM</p>
      <p>Call <a href="tel:+919949051777">${PHONE}</a></p>
      <p>WhatsApp <a href="https://wa.me/919398693051" target="_blank" rel="noopener">+91 93986 93051</a></p>
    </div>
    <div>
      <h2>Explore</h2>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/menu/">Full menu</a></li>
        <li><a href="/#reserve">Reserve a table</a></li>
        <li><a href="/blog/">From Our Kitchen</a></li>
      </ul>
    </div>
  </div>
  <div class="bl-foot__legal">
    <span>© ${new Date().getFullYear()} ${esc(BRAND)}</span>
    <span>FSSAI Lic. No. 13625010001231</span>
    <span><a href="/privacy.html">Privacy Policy</a></span>
  </div>
</footer>
${withVideo ? VIDEO_SCRIPT : ''}
</body>
</html>
`;

const card = (p, headingLevel = 3) => `<li class="bl-card">
  <img class="bl-card__img" src="${p.cardImg.src}"${p.cardImg.srcset ? ` srcset="${p.cardImg.srcset}" sizes="(max-width: 720px) 82vw, (max-width: 1100px) 45vw, 340px"` : ''} width="${p.cardImg.width}" height="${p.cardImg.height}" alt="" loading="lazy" decoding="async">
  <div class="bl-card__body">
    <span class="bl-card__meta"><time datetime="${p.date}">${niceDate(p.date)}</time> · ${p.minutes} min read</span>
    <h${headingLevel}><a href="/blog/${p.slug}/">${esc(p.title)}</a></h${headingLevel}>
    <p>${esc(p.description)}</p>
    <span class="bl-card__more" aria-hidden="true">Read the story →</span>
  </div>
</li>`;

function postPage(p, others) {
  const url = `${SITE}/blog/${p.slug}/`;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description,
      image: p.og ? [`${SITE}${p.og}`] : undefined, datePublished: p.date, dateModified: p.date, mainEntityOfPage: url,
      author: { '@type': 'Organization', name: BRAND },
      publisher: { '@type': 'Organization', name: BRAND, url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/tsk-original-logo.webp` } },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'From Our Kitchen', item: `${SITE}/blog/` },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ],
    },
  ].map(jsonLd).join('\n');
  const share = `https://wa.me/?text=${encodeURIComponent(`${p.title} ${url}`)}`;
  const more = others.length ? `<section class="bl-more" aria-labelledby="more-title"><div class="bl-wrap"><h2 id="more-title">More from our kitchen</h2><ul class="bl-cards">${others.map((o) => card(o)).join('\n')}</ul></div></section>` : '';
  return head({ title: `${p.title} | ${BRAND}`, description: p.description, canonical: url, image: p.og, type: 'article', extra: ld }) + `
<main id="main">
<article>
  <div class="bl-narrow">
    <nav class="bl-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog/">From Our Kitchen</a></nav>
    <header class="bl-head">
      <p class="bl-meta"><time datetime="${p.date}">${niceDate(p.date)}</time> · ${p.minutes} min read</p>
      <h1>${esc(p.title)}</h1>
      <p class="bl-lede">${esc(p.description)}</p>
    </header>
  </div>
  <figure class="bl-cover">${imgTag(p.coverImg, p.coverAlt, '(max-width: 1012px) 100vw, 980px', 'fetchpriority="high" decoding="async"')}</figure>
  <div class="bl-narrow">
    <div class="bl-prose">
${p.html}
${p.videoHtml}
    </div>
    <aside class="bl-cta" aria-labelledby="cta-title">
      <h2 id="cta-title">Taste it at TSK</h2>
      <p>Open every day, 11 AM to 11 PM on Gandipet Main Road, Kokapet.</p>
      <div class="bl-cta__acts">
        <a class="bl-btn bl-btn--gold" href="${ORDER_URL}" target="_blank" rel="noopener">Order on Ownly</a>
        <a class="bl-btn bl-btn--line" href="/#reserve">Reserve a table</a>
        <a class="bl-btn bl-btn--line" href="tel:+919949051777">Call ${PHONE}</a>
      </div>
    </aside>
    <p class="bl-share">Enjoyed this? <a href="${share}" target="_blank" rel="noopener">Share it on WhatsApp</a></p>
  </div>
</article>
${more}
</main>
` + foot(p.hasVideo);
}

function blogIndexPage(posts) {
  const url = `${SITE}/blog/`;
  const desc = 'Stories behind our dishes, and notes from the kitchen at TSK – The Spice Kitchen, Kokapet.';
  const ld = jsonLd({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `From Our Kitchen | ${BRAND}`, description: desc, url });
  return head({ title: `From Our Kitchen | ${BRAND}`, description: desc, canonical: url, image: posts[0].og, extra: ld }) + `
<main id="main">
  <div class="bl-wrap">
    <nav class="bl-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / From Our Kitchen</nav>
    <header class="bl-index-head">
      <h1>From Our Kitchen</h1>
      <p>${esc(desc)}</p>
    </header>
    <section class="bl-index-list" aria-label="All stories"><ul class="bl-cards">
${posts.map((p) => card(p, 2)).join('\n')}
    </ul></section>
  </div>
</main>
` + foot(false);
}

function homeBlock(posts) {
  if (!posts.length) return '';
  const shown = posts.slice(0, HOME_CARDS);
  return `<!-- Generated by _tools/build-blog.mjs from _blog/posts. Don't edit by hand: changes are replaced the next time a post is saved. -->
<section class="bl-home" id="stories" aria-labelledby="stories-title">
  <link rel="stylesheet" href="/blog/blog.css?v=${cssVersion}">
  <div class="wrap">
    <div class="bl-home__in">
      <div class="bl-home__head">
        <div>
          <h2 id="stories-title">From Our Kitchen</h2>
          <p>Stories behind our dishes, and notes from the kitchen.</p>
        </div>
        <a class="bl-home__all" href="/blog/">See all stories →</a>
      </div>
      <ul class="bl-cards">
${shown.map((p) => card(p)).join('\n')}
      </ul>
    </div>
  </div>
</section>`;
}

/* ───────────── sitemap ───────────── */
function updateSitemap(posts) {
  const file = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(file, 'utf8');
  xml = xml.replace(/\s*<url>\s*<loc>[^<]*\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  if (posts.length) {
    const entries = [
      `  <url>\n    <loc>${SITE}/blog/</loc>\n    <lastmod>${posts[0].date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
      ...posts.map((p) => `  <url>\n    <loc>${SITE}/blog/${p.slug}/</loc>\n    <lastmod>${p.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`),
    ].join('\n');
    xml = xml.replace('</urlset>', `${entries}\n</urlset>`);
  }
  fs.writeFileSync(file, xml);
}

/* ───────────── main ───────────── */
const posts = readPosts();
fs.rmSync(OUT, { recursive: true, force: true });

for (const p of posts) {
  p.coverImg = await processImage(p.cover);
  if (!p.coverImg) { warn(`${p.file}: skipped because its cover photo "${p.cover}" was not found in the photo library.`); p.skip = true; continue; }
  p.cardImg = p.coverImg;
  p.og = p.coverImg.ogFile;
  const body = await renderBody(p.body);
  p.html = body.html;
  const v = p.video ? parseVideo(p.video) : null;
  if (p.video && !v) warn(`${p.file}: the video link is not a YouTube or Instagram link, so no video was added.`);
  p.videoHtml = v ? videoHtml(v) : '';
  p.hasVideo = body.hasVideo || !!v;
}
const live = posts.filter((p) => !p.skip);
const seen = new Set();
for (const p of live) { if (seen.has(p.slug)) warn(`Two posts share the web address /blog/${p.slug}/.`); seen.add(p.slug); }

if (live.length) {
  fs.copyFileSync(path.join(import.meta.dirname, 'blog.css'), path.join(OUT, 'blog.css'));
  for (const p of live) write(path.join(OUT, p.slug, 'index.html'), postPage(p, live.filter((o) => o !== p).slice(0, 3)));
  write(path.join(OUT, 'index.html'), blogIndexPage(live));
}

/* Fills the generated parts of index.html: the cards above the FAQs, and the "Stories" link in the top menu and the
   side panel. The link only exists while there is at least one published post, so it never points at a missing page. */
const fill = (html, name, content) => {
  const s = `<!-- ${name}:START -->`, e = `<!-- ${name}:END -->`;
  const a = html.indexOf(s), b = html.indexOf(e);
  if (a < 0 || b < a) throw new Error(`index.html is missing the ${s} / ${e} markers.`);
  const eol = html.includes('\r\n') ? '\r\n' : '\n'; // keep the file's own line endings so reruns never churn
  return html.slice(0, a + s.length) + eol + content.replace(/\r?\n/g, eol) + (content ? eol : '') + html.slice(b);
};
let nextHome = fill(indexHtml, 'BLOG', homeBlock(live));
nextHome = fill(nextHome, 'BLOG-NAV', live.length ? '      <li><a href="/blog/">Stories</a></li>' : '');
nextHome = fill(nextHome, 'BLOG-SHEET', live.length ? '    <li><a class="big" href="/blog/">Stories</a></li>' : '');
if (nextHome !== indexHtml) fs.writeFileSync(path.join(ROOT, 'index.html'), nextHome);
updateSitemap(live);

console.log(`Blog built: ${live.length} published post${live.length === 1 ? '' : 's'}${live.length ? ' (' + live.map((p) => p.slug).join(', ') + ')' : ''}.`);
