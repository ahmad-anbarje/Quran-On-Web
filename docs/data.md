# The data

| File                            | What it is                                            |
|---------------------------------|--------------------------------------------------------|
| `public/data/mushaf.json`       | 604 pages × their lines, with V1 and V2 glyph codes    |
| `public/data/surahs.json`       | The 114-surah index, 13 KB — all the reader loads      |

Both are written by `npm run build:mushaf`.

`mushaf.json` is built from `api.quran.com` v4, which gives every word its
printed page and line. Ornamental lines are inferred from the gaps that leaves
in the line grid: a surah's header, and its Basmalah, go into the empty lines
directly above its first word.

On 18 pages the mushaf leaves only one line free above a surah that needs two,
and squeezes the Basmalah onto the header's line — those lines carry `b:1` in
the data. Page 77 (An-Nisa) is one of them.

**The reader does not follow the mushaf here.** It gives the Basmalah a line of
its own on all 114 openings, so every surah opens the same way — and it costs
no page height. A sheet is always exactly its slot count tall, and every line
in it is one line high, ornamental or not.

The room comes from the header line. Where a surah opens at the *top* of a page
the running head already names it, so no header line is drawn at all. Where one
opens *partway down*, the head belongs to the surah above it — heading page 106
"Al-Ma'idah" would be a lie about its top half — so that break is drawn and
names itself, in the same tag the head uses.

Every line is one line tall, ornamental or not, and a sheet is simply as tall
as the lines it draws. So a page that opens a surah at its top comes out one
line shorter than one that does not — 14 lines against 15. Nothing flexes and
nothing is special-cased; the height follows from the line count.

That is the print, not a gap in the data: all 14 of page 77's text lines
measure a full 15.5–15.8em in the V2 font, so the page really does give 14 of
its 15 lines to text. `npm run test:fonts` checks this for every page.

`juzPages` holds the page each of the 30 juz opens on. They are not evenly
spaced — juz 7 opens on page 121 and juz 11 on page 201 — so they are read from
the API rather than calculated.

The Basmalah itself is drawn from page 1's font: Al-Fatihah 1:1 *is* the
Basmalah, so the glyphs already exist there in both versions and always match
the selected face.

The surah name comes from `sura-names.woff2`, one calligraphic glyph per surah
at U+E001–E114, addressed by reading the surah's decimal number as hexadecimal.
Those glyphs draw the **name only** — there is none for the word "سورة". The
name is set once per sheet. Where a surah opens at the top of a page the
running head names it and the header line is left blank; where one opens
partway down, the head belongs to the surah above it, so the break carries the
name itself — otherwise page 106 would head the whole sheet "Al-Ma'idah" while
its top half is still An-Nisa. `surahs.json` also holds a vocalised `full` name
("سُورَةُ البَقَرَةِ") from alquran.cloud — api.quran.com spells them bare —
which rides along as the head's label.

The Basmalah can only come from page 1. The same codes exist in other page
fonts, but they mean that page's own words there: `ﱁﱂﱃﱄ` is the Basmalah in
p1.woff2 and Al-Baqarah's opening four words in p2.woff2. Al-Fatihah 1:1 *is*
the Basmalah, so page 1 is the one place those glyphs are what they say, and
all 112 Basmalahs are drawn from it.
