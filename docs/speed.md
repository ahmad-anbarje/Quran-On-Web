# Speed

Two things dominate, and both are handled:

- **Boot payload.** The reader loads `surahs.json` (13 KB) and `mushaf.json`
  (923 KB, ~72 KB gzipped) and nothing else. Responses are compressed, and the
  page fonts are served `immutable` — they never change once fetched.
- **Page building.** A surah can run to 48 pages of 15 lines each. Building
  them all up front meant 6400 word spans before anything appeared, so pages
  are built when they come into reach and dropped once well past — an emptied
  page still reserves its height, so scrolling does not jump. Registered fonts
  are capped at 24 for the same reason.

  That cap is why a built page has to be dropped once it is out of view. A page
  left built while its face is evicted underneath it renders its glyph codes as
  raw text, which is what turning spreads quickly used to do: the spread mode
  hydrated pages and never dropped them. It now keeps only the two on screen,
  and `hydrate()` treats a page whose face has gone as unbuilt and rebuilds it.

- **Turning a page.** Fetching a page font is the only slow part — the DOM is a
  millisecond and the fit a handful — so the pages either side of the one being
  read are fetched while it is still on screen (`warmNeighbours`). By the time
  the reader turns, the font is already registered and the turn is a few frames.
  The fit also avoids resolving a computed style unless a line is short enough
  to need centring, which almost none are: every registered page font takes part
  in a style match, so that one read cost more than everything else together.

  The layout audit budgets the part that is ours — see `tests/README.md`.
