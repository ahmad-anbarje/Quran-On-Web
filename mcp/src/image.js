/**
 * A picture of ayahs as the Madinah Mushaf prints them: the page's own lines in
 * its QCF v4 face, the ayahs around faded, for hosts that show images but not
 * apps. Drawn with Skia (@napi-rs/canvas), no browser, once per run of ayahs:
 * the PNG is kept on disk ($STATE_DIRECTORY/images) and served from there after.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const FONTS = path.join(__dirname, '..', '..', 'public', 'fonts');
// Pictures are kept by edition, so a v2 one is never served for v4
const CACHE = path.join(process.env.STATE_DIRECTORY || path.join(os.tmpdir(), 'readquran-mcp'), 'images-v4');
const MAX_LINES = 15;   // one mushaf page

const W = 1200, PAD = 56, HEAD = 84, FOOT = 64;
const INK = '#1b2a36', FADED = 'rgba(27, 42, 54, 0.26)', PAPER = '#fffdf6', ACCENT = '#1a6fa3', RULE = '#e7e1cf';

let canvas = null;
const faces = new Set();
function face(name, file) {
  if (!canvas) canvas = require('@napi-rs/canvas');
  if (!faces.has(name)) { canvas.GlobalFonts.registerFromPath(path.join(FONTS, file), name); faces.add(name); }
  return name;
}

function draw(q, s, from, to, lines) {
  const { createCanvas } = canvas || require('@napi-rs/canvas');
  const info = q.surah(s);
  const ui = face('Cairo', path.join('ui', 'cairo-400-arabic.woff2'));
  face('CairoLatin', path.join('ui', 'cairo-400-latin.woff2'));

  // Each line's words at a trial size, then the size that makes the widest fill the measure
  const TRY = 50, avail = W - 2 * PAD;
  const probe = createCanvas(10, 10).getContext('2d');
  const rows = lines.map((line) => {
    probe.font = `${TRY}px ${face('qcf' + line.page, path.join('v4', `p${line.page}.woff2`))}`;
    const widths = line.words.map(([g]) => probe.measureText(g).width);
    return { ...line, widths, natural: widths.reduce((a, b) => a + b, 0) };
  });
  const widest = Math.max(...rows.map((r) => r.natural));
  const size = Math.min(76, TRY * avail / widest), k = size / TRY, LINE = Math.round(size * 1.75);

  const H = HEAD + rows.length * LINE + FOOT + PAD / 2;
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);

  // The surah and the ayahs, as a heading above the page's lines
  x.fillStyle = ACCENT; x.textBaseline = 'middle';
  x.font = `600 34px ${ui}`; x.direction = 'rtl'; x.textAlign = 'right';
  x.fillText(`سورة ${info.name}`, W - PAD, HEAD / 2 + 6);
  x.font = '26px CairoLatin, Cairo'; x.direction = 'ltr'; x.textAlign = 'left';
  x.fillText(`${info.en} ${s}:${from}${to > from ? '–' + to : ''} · page ${q.page(s, from)}`, PAD, HEAD / 2 + 6);
  x.fillStyle = RULE; x.fillRect(PAD, HEAD, avail, 2);

  // Each line right to left, flush to both margins as the page sets it; a much shorter one centred
  x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.direction = 'ltr';
  rows.forEach((r, i) => {
    const ws = r.widths.map((w) => w * k), total = r.natural * k;
    const short = r.natural < widest * 0.8;
    const gap = short ? size * 0.25 : (r.words.length > 1 ? (avail - total) / (r.words.length - 1) : 0);
    let at = short ? W / 2 + (total + gap * (r.words.length - 1)) / 2 : W - PAD;
    const y = HEAD + i * LINE + LINE * 0.78;
    x.font = `${size}px qcf${r.page}`;
    r.words.forEach(([g, a], j) => {
      at -= ws[j];
      x.fillStyle = a >= from && a <= to ? INK : FADED;
      x.fillText(g, at, y);
      at -= gap;
    });
  });

  x.fillStyle = RULE; x.fillRect(PAD, H - FOOT - PAD / 4, avail, 2);
  x.fillStyle = ACCENT; x.font = '24px CairoLatin, Cairo'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('readqurantoday.com · Madinah Mushaf', W / 2, H - FOOT / 2 - PAD / 8);
  return c.toBuffer('image/png');
}

/* The run's picture, from the disk when it has been drawn before */
const drawing = new Map();
async function ayahImage(q, s, from, to) {
  const lines = q.mushafLines(s, from, to);
  if (lines.length > MAX_LINES) return { error: `That is ${lines.length} lines of the mushaf; a picture holds one page (${MAX_LINES}). Ask for fewer ayahs.` };
  const file = path.join(CACHE, `${s}-${from}-${to}.png`);
  try { return { png: await fs.promises.readFile(file) }; } catch (e) { /* not drawn yet */ }
  const key = file;
  if (!drawing.has(key)) {
    drawing.set(key, (async () => {
      const png = draw(q, s, from, to, lines);
      await fs.promises.mkdir(CACHE, { recursive: true });
      await fs.promises.writeFile(file, png).catch(() => { /* served undrawn next time */ });
      return png;
    })().finally(() => drawing.delete(key)));
  }
  return { png: await drawing.get(key) };
}

module.exports = { ayahImage, MAX_LINES };
