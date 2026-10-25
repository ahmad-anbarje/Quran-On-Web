/**
 * A page for every ayah: /surah/<s>/<a>/, 6236 of them.
 *
 * What a search for one ayah wants, "Ayat al-Kursi", "2:255", "surah yasin
 * ayah 1", found nothing to land on before: the site had a page a surah. Each
 * of these is a page of text like /surah/<s>/text/, light, with its own
 * stylesheet and none of the reader's weight: the ayah in Arabic, the King
 * Fahd Complex's English (Hilali and Muhsin Khan), the Tafsir al-Muyassar, and
 * the words one by one with their Latin reading and meaning. Enough of its own
 * that it is a page worth finding, not a stub; and from it the reader, opened
 * at the mushaf page the ayah is on (/surah/<s>/?ayah=<a>), and the ayahs
 * either side.
 *
 * Built by build-pages.js, from the files the site already serves.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const surahText = require('./surah-text');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(PUBLIC, 'data');

const ENGLISH = { id: 'hilali', name: 'Muhammad Taqi-ud-Din al-Hilali and Muhammad Muhsin Khan, King Fahd Complex' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const json = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

/* A description is shown to about 155 characters; cut at a word, not inside one */
function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/* Where each ayah begins in the mushaf. A page's word list ends each ayah
   with its number in Arabic figures, so counting those across the 604
   pages, in order, numbers all 6236 ayahs. */
function ayahPages(surahs) {
  const pageOf = [];
  let i = 0;
  for (let p = 1; p <= 604; p++) {
    for (const w of json(DATA, 'words', `p${p}.json`)) {
      if (pageOf[i] === undefined) pageOf[i] = p;
      if (/^[٠-٩]+$/.test(w)) i++;
    }
  }
  if (i !== 6236) throw new Error(`counted ${i} ayahs across the pages, not 6236`);
  const out = {};
  let n = 0;
  surahs.forEach((s) => { out[s.id] = pageOf.slice(n, n + s.v); n += s.v; });
  return out;
}

function page({ s, a, arabic, english, tafsir, latin, meaning, onPage, site, prev, next }) {
  const ref = `${s.id}:${a}`;
  const url = `${site}/surah/${s.id}/${a}/`;
  const title = `سورة ${s.name} الآية ${ar(a)} · Surah ${s.en} ${ref}`;
  const desc = clip(`${arabic} — ${english}`, 160);
  const schema = [{
    '@context': 'https://schema.org',
    '@type': 'Quotation',
    name: `Surah ${s.en} ${ref}`,
    text: arabic,
    inLanguage: 'ar',
    url,
    isPartOf: { '@type': 'Chapter', name: `سورة ${s.name} · Surah ${s.en}`, position: s.id, url: `${site}/surah/${s.id}/` },
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'القرآن الكريم', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: `سورة ${s.name} · Surah ${s.en}`, item: `${site}/surah/${s.id}/` },
      { '@type': 'ListItem', position: 3, name: `الآية ${ar(a)} · ${ref}`, item: url },
    ],
  }];
  const step = (to, rel, label) => to
    ? `<a rel="${rel}" href="/surah/${to.s}/${to.a}/">${label} ${to.s}:${to.a}</a>`
    : '<span></span>';
  const words = latin && meaning && latin.length === meaning.length
    ? `
  <section lang="en" dir="ltr">
    <h2>Word by word</h2>
    <table class="words">
      <thead><tr><th>#</th><th>Reading</th><th>Meaning</th></tr></thead>
      <tbody>
${latin.map((l, i) => `        <tr><td>${i + 1}</td><td>${esc(l)}</td><td>${esc(meaning[i])}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </section>
` : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${site}/icon-512.png" />
<meta name="twitter:card" content="summary" />
<link rel="stylesheet" href="/css/fonts.css" />
<link rel="stylesheet" href="/css/text.css" />
<script type="application/ld+json">
${JSON.stringify(schema)}
</script>
</head>
<body>
<main class="text-page ayah-page">
  <nav class="crumbs">
    <a href="/">القرآن الكريم</a> ·
    <a href="/surah/${s.id}/">سورة ${esc(s.name)}</a> ·
    الآية ${ar(a)}
  </nav>

  <h1>سورة ${esc(s.name)}، الآية ${ar(a)}<span class="en">Surah ${esc(s.en)}, ayah ${a} (${ref})</span></h1>

  <p class="ayah">${esc(surahText.hafs(arabic))} <span class="n">${ar(a)}</span></p>

  <p class="meta">
    الصفحة ${ar(onPage)} من مصحف المدينة · <a href="/surah/${s.id}/?ayah=${a}">اقرأها في المصحف مع التلاوة</a><br />
    <span lang="en" dir="ltr">Page ${onPage} of the Madinah Mushaf · <a href="/surah/${s.id}/?ayah=${a}">Read it in the mushaf, with recitation</a></span>
  </p>

  <section lang="en" dir="ltr">
    <h2>The meaning in English</h2>
    <p>${esc(english)}</p>
    <p class="src">${esc(ENGLISH.name)}</p>
  </section>

  <section>
    <h2>التفسير الميسر</h2>
    <p>${esc(tafsir)}</p>
    <p class="src">التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف</p>
  </section>
${words}
  <nav class="steps" dir="ltr">
    ${step(prev, 'prev', '←')}
    <a href="/surah/${s.id}/">Surah ${esc(s.en)}</a>
    ${step(next, 'next', '→')}
  </nav>
</main>
</body>
</html>
`;
}

/** Writes the pages and returns their urls, for the sitemap. */
function build(surahs, site) {
  const arabic = surahText.spellings(surahs);
  const pages = ayahPages(surahs);
  const urls = [];
  const all = [];         // every ayah in order, for the steps either side
  surahs.forEach((s) => { for (let a = 1; a <= s.v; a++) all.push({ s: s.id, a }); });
  let i = 0;

  surahs.forEach((s) => {
    const english = json(DATA, 'translation', ENGLISH.id, `${s.id}.json`);
    const tafsir = json(DATA, 'tafsir', 'muyassar', `${s.id}.json`);
    const latin = json(DATA, 'translit', `${s.id}.json`);
    const meaning = json(DATA, 'meaning', `${s.id}.json`);
    for (let a = 1; a <= s.v; a++, i++) {
      const dir = path.join(PUBLIC, 'surah', String(s.id), String(a));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), page({
        s, a, site,
        arabic: arabic[s.id].uthmani[a - 1],
        english: english[a - 1],
        tafsir: tafsir[a - 1],
        latin: latin[a - 1],
        meaning: meaning[a - 1],
        onPage: pages[s.id][a - 1],
        prev: all[i - 1],
        next: all[i + 1],
      }));
      urls.push(`${site}/surah/${s.id}/${a}/`);
    }
  });
  return urls;
}

module.exports = { build };
