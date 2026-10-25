/**
 * Files to save: a surah as plain text, made when its link is opened.
 *
 *   /mcp/files/surah-18.txt                         the Arabic
 *   /mcp/files/surah-18.txt?translation=hilali      each ayah with its translation
 *   /mcp/files/surah-18.txt?tafsir=1                and the Tafsir al-Muyassar
 *
 * get_file hands an assistant the link rather than the text itself: a surah
 * with its translation is tens of thousands of words, which belong in the
 * reader's downloads, not in the conversation. The recordings need nothing
 * here; their MP3s are on the audio host already.
 */
'use strict';

const { translationName } = require('./shared');

const PATH = /^\/mcp\/files\/surah-(\d{1,3})\.txt$/;

function fileUrl(q, s, { translation, tafsir } = {}) {
  const p = new URLSearchParams();
  if (translation) p.set('translation', translation);
  if (tafsir) p.set('tafsir', '1');
  const query = p.toString();
  return `${q.SITE}/mcp/files/surah-${s}.txt${query ? '?' + query : ''}`;
}

/* "surah-18-al-kahf-hilali-tafsir.txt": what the browser saves it as */
function fileName(q, s, { translation, tafsir } = {}) {
  const slug = q.surah(s).en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [`surah-${s}`, slug, translation, tafsir && 'tafsir'].filter(Boolean).join('-') + '.txt';
}

/** The file's text, or null if the surah or translation is not there. */
function surahFile(q, s, { translation, tafsir } = {}) {
  const info = q.surah(s);
  if (!info || (translation && !q.hasTranslation(translation))) return null;
  const text = translation ? q.translation(translation, s) : null;
  const notes = tafsir ? q.tafsir(s) : null;
  const out = [
    `سورة ${info.name} · Surah ${info.en} (${s}), ${info.v} ayahs`,
    'The Madinah Mushaf, Hafs',
    ...(text ? [`Translation: ${translationName(q, translation)}`] : []),
    ...(notes ? ['التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف'] : []),
    `From ${q.link(s)}`,
    '',
  ];
  if (q.arabic[s].basmala) out.push(q.arabic[s].basmala, '');
  q.arabic[s].uthmani.forEach((ayah, i) => {
    out.push(`${s}:${i + 1}  ${ayah}`);
    if (text) out.push(text[i]);
    if (notes) out.push(`التفسير: ${notes[i]}`);
    out.push('');
  });
  return out.join('\n');
}

/** Answers GET /mcp/files/...; false when the path is not one of these. */
function serveFile(q, req, res) {
  const url = new URL(req.url, 'http://x');
  const m = PATH.exec(url.pathname);
  if (!m) return false;
  const s = Number(m[1]);
  const opts = { translation: url.searchParams.get('translation') || undefined, tafsir: url.searchParams.get('tafsir') === '1' };
  const body = surahFile(q, s, opts);
  if (body === null) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No such surah or translation.\n');
    return true;
  }
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName(q, s, opts)}"`,
    // The same file every time until the site's data changes, which a deploy does
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

module.exports = { fileUrl, fileName, surahFile, serveFile };
