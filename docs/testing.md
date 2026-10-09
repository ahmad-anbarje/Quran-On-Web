# Testing

Everything that checks the app is in `tests/` — see [tests/README.md](../tests/README.md).

## The layout audit

The one that answers "does any page look wrong?" without opening 114 surahs.
With the server up, open <http://localhost:3000/tests/audit.html>, pick a screen
size and zoom, and hit Run. It renders all 604 pages inside a frame the size of
that screen, measures every sheet, and lists what is off: a
line running past the sheet, a page taller than the screen, a missing surah
header or closing line, a type size that drifts from its version's norm. Click
a row to see the page.

## Command line

```bash
npm run fetch:reference   # one-off: downloads the texts to check against
npm test
```

34 checks in three groups. `npm run test:data`, `test:fonts` and `test:perf`
run them separately; each exits non-zero on failure.

**Data** — the layout against two unrelated copies of the Quran (Tanzil and
alquran.cloud) plus a word-by-word reference: 6236 verses, 83665 words in
reading order, verse counts and spelling verse for verse, one header per surah,
112 Basmalahs, and page ranges that match where the words actually print.

**Fonts** — this is what proves the marks are drawn. A V2 page font encodes its
page's words as one unbroken ascending run of codes, so a printed word the
layout skipped would leave a hole in that run. Checking that the run has no
holes, on all 604 pages, means no diacritic, pause mark, sajdah sign or ayah
marker can be missing. It also confirms the pages really are drawn to one scale
(line width 15.56em, spread 2.9%), which is what lets the whole mushaf be set at
a single size.

**Speed** — starts the real server and holds it to a budget: boot payload over
the wire, compression on text but not on woff2, immutable caching on the page
fonts, `.env` not served, and how many spans a page and a surah actually
build.

## On testing the marks

Your list — tashkeel, waqf signs, recitation marks, section marks — cannot be
checked by looking for those characters in what we render, because we render
glyphs, not letters: a QCF glyph is a whole word with its marks already drawn
in. So the suite checks it from both ends. `check-data.js` counts every mark
in the Uthmani spelling of the words we lay out and compares against Tanzil;
`check-fonts.py` proves the glyphs standing for those words are all present
and all used.

Two marks are reported as written differently rather than missing: this mushaf
spells sukun U+0652 where your list has U+06E1, and madda U+0653 where the list
has U+06E4. Both are the same mark under a different convention. The end-of-ayah
sign is not a character here at all — it is its own glyph, and is checked by
confirming all 6236 verses close with exactly one.
