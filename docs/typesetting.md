# Typesetting the mushaf

The reader sets the mushaf in **QCF V2**, the current Madinah Mushaf face from
the King Fahd Glorious Quran Printing Complex. `mushaf.json` carries QCF V1
codes as well and the test suite checks them, but nothing in the reader draws
them — `public/fonts/v1` can be deleted, and `npm run test:fonts` will skip
that half rather than fail.

These are *page fonts*, not ordinary Arabic fonts. They contain no letters:
each glyph is a whole word, drawn exactly as it appears on one specific page,
so there is one font file per mushaf page — 604 per version. Page 5's codes
render as the wrong words in page 6's font.

That has three consequences worth knowing:

- The glyph codes in `public/data/mushaf.json` and the files in
  `public/fonts/` must come from the same source. Rebuild them together.
- A page's font is registered from JavaScript as the page scrolls into reach,
  rather than as 1208 `@font-face` rules the browser would have to carry.
- Verse numbers are glyphs in the line, not markup, so they are set by the
  typeface and cannot drift out of the text block.

## How the type is sized

Every page font of a version is drawn to one scale — the ayah marker measures
1.245em on all 604 V1 pages — so **the mushaf is set at a single type size
throughout**. A version's line width in ems (`fit.body` in `mushaf.json`) is
all the reader needs; nothing is measured per page, which is what used to make
the size jump between surahs.

The size is the smallest of three bounds, worked out in CSS on the sheet:

| bound | what it is |
|---|---|
| zoom | the size asked for: `--page-measure × zoom ÷ fit.body` |
| width | the same against the width the sheet **actually got** (`100cqw`) |
| height | one whole page on screen: `(screen − chrome) × zoom ÷ (15 lines × 1.92)` |

The sheet is then made exactly as wide as the lines it holds. Two things fall
out of that. A line can no longer run past the sheet, because the width bound
is the real width rather than the width the sheet asked for — on a screen too
narrow to grant it, zooming now stops instead of overflowing. And at 100% a
full mushaf page fits the screen, so the zoom control reads as a fit: click the
percentage to come back to it.

The height bound always divides by 15, the mushaf's line grid, not by the
page's own line count. Pages 1 and 2 have eight lines because their ornamental
frame leaves less room, but they are set in the *same* type — dividing by eight
would draw Al-Fatihah at nearly twice the size of everything else.

Two facing pages halve the width each one gets, so the width bound divides by
`--m-cols` — 1 normally, 2 in spread mode. Without that the type would be sized
for the whole container and run straight off the sheet.

The turn buttons are kept off the page by `--turn-lane`, which is padding on
`#content-area` rather than a number subtracted from the type size. That is the
whole point: the query container sits inside that padding, so `100cqw` already
excludes the lane and the page *cannot* be sized into it, at any zoom, in
either mode. The previous approach subtracted a reserve inside the size
formula while the buttons were positioned by a separate rule — two sums that
had to agree, and on a short window they did not.

Where they sit *within* that lane comes from `--sheet-w`, which the app writes
after each fit (`publishSheetWidth`). The turner bar is then as wide as the
page plus one lane either side, so each button sits the same distance from the
paper whatever width the page came out — and the distance is the same on both
sides because `scrollbar-gutter: stable both-edges` stops the scrollbar
shifting the page off-centre. CSS cannot work `--sheet-w` out for itself: it
falls out of a container query that only resolves inside `#ayahs-container`,
and recomputing it outside would recreate exactly the two-sums problem above.

On a phone there is no width to flank with, so the turners drop below the page
into the layout: `body` becomes a column holding the app and the bar, the
reading area ends where the bar begins, and neither can reach the other.

`--fit-scale` is what the height bound may grow by. One page scrolls, so zoom
can carry it past the screen and the reader scrolls to follow. Two facing pages
have nowhere to scroll, so a spread pins it to 1: zoom enlarges the type until
the page fills the screen and then stops, instead of pushing the bottom lines
somewhere they cannot be reached.

The size is worked out per sheet, with `#ayahs-container` as the query
container. Hoisting it so it is computed once looks like the obvious saving and
is not: it was tried, and it made fitting a page **250x slower** (0.6ms to
166ms), because one shared value has to be resolved against every sheet that
inherits it. The layout audit caught it; see `tests/README.md`.

`--sheet-chrome` is everything a sheet spends on something other than type:
its padding, the folio, the gap above it. It is deliberately small, because
every pixel of it is a pixel of type the reader does not get.

The two versions still fill the measure differently. **V2 bakes the
justification into its glyph advances**: every line is drawn to nearly the same
width (the median fills 98% of the measure), so the words sit flush with barely
a gap. **V1 does not** — its lines run from 12 to 21em and fill about 71%, and
the leftover space is spread between the words, which is how a V1 mushaf is set.

Two ends are still settled at runtime. A handful of lines are drawn wider than
the rest and are set slightly smaller. At the other end, a line well short of
the measure is centred rather than pulled out to both margins — that is what
the framed opening spread needs, and what a surah's closing line needs. The
threshold differs by version, because the versions intend different word
spacing: below 92% of the measure a V2 line is genuinely short, while a V1 line
filling two thirds is ordinary and wants its gaps.

## Nothing is fetched from anyone else

The page makes no third-party request. jQuery is served from `js/vendor/`, and
the interface font, Cairo, from `fonts/ui/` via `css/fonts.css`, which
`scripts/fetch-ui-fonts.py` writes. Only the Arabic and Latin subsets are kept —
the family also ships other scripts this app never draws.

That is partly speed: two fewer connections to open before the first paint, and
neither of them on the critical path. It is also that a reader of the Quran
should not be announced to a CDN to read it — and it is what lets the
Content-Security-Policy in `deploy/` be `default-src 'self'`.

