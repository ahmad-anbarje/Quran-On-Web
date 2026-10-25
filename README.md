<p align="center">
  <img src="docs/banner.png" width="100%" alt="القرآن العظيم — The Great Quran: Madinah Mushaf and recitation">
</p>

<p align="center">
  <b>Read Quran Today</b> — the Madinah Mushaf on the web, page for page,<br>
  with recitation that highlights each word as it is read.
</p>

<p align="center">
  <a href="https://readqurantoday.com"><img src="https://img.shields.io/badge/-readqurantoday.com-1a6fa3?style=for-the-badge&amp;logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCcgZmlsbD0nbm9uZScgc3Ryb2tlPSd3aGl0ZScgc3Ryb2tlLXdpZHRoPScyJyBzdHJva2UtbGluZWNhcD0ncm91bmQnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiLz48cGF0aCBkPSJNMyAxMmgxOE0xMiAzYzIuNSAyLjYgMi41IDE1LjQgMCAxOE0xMiAzYy0yLjUgMi42LTIuNSAxNS40IDAgMTgiLz48L3N2Zz4=" alt="readqurantoday.com"></a>
  <a href="https://hub.docker.com/r/ahmadanbarje/quran"><img src="https://img.shields.io/docker/pulls/ahmadanbarje/quran?style=for-the-badge&amp;logo=docker&amp;logoColor=white&amp;label=Docker%20pulls&amp;color=2496ED" alt="Docker pulls"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-555555?style=for-the-badge" alt="MIT licence"></a>
</p>

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.readqurantoday.quran"><img src="public/badges/google-play-en.png" alt="Get it on Google Play" height="56"></a>
</p>

## Features

**Reading**
- The Madinah Mushaf page by page, 15 lines to a page, at one type size throughout
- One page at a time, or two facing as the mushaf opens on wide screens
- Zoom and a magnifier, full screen, three text weights, a page dimmer
- A running head on every page: juz, surah and page number

**Listening**
- Four reciters in five recordings, with each word highlighted as it is recited
- The word being recited spelled out in Latin letters (transliteration), with its
  meaning beneath, in the chosen translation's language where it has one word by
  word (Urdu, Indonesian, Bengali, Turkish, Persian, Hindi) and in English otherwise
- The meaning of each ayah in a window that keeps up with the recitation, moved
  and sized as the reader likes: 127
  translations in 88 languages, and the Tafsir al-Muyassar; each credited, with
  a link to its source
- Find a translation by typing: a language in Arabic, English or its own name,
  or a translator; the first time, the language of the reader's country (or device) is chosen
- Start from any word, change the speed, and repeat an ayah, a range or the
  whole surah, a set number of times or without end
- Download a recitation to keep

**Finding your place**
- An index of the 114 surahs and 30 juz, searchable by name or number
- Search the text of the Quran by its words, with or without diacritics
- A page for every surah (`/surah/N/`) and every juz (`/juz/N/`), and a plain
  text version of each surah for screen readers and search engines
- Picks up at the last page read; saved pages, with no account

**Everywhere**
- Phones, tablets and desktops; swipe, keyboard shortcuts or the on-screen buttons
- Offline reading (the whole mushaf, about 95 MB, asked before it is saved or removed), installable, dark and light
- The site in 14 languages: Arabic, English, Urdu, Indonesian, Bengali, Turkish,
  French, Persian, Hindi, Malay, Spanish, Russian, German and Chinese, chosen in
  Settings or from the browser's language; Urdu and Persian read right to left.
  Picking a language in Settings picks its translation in the meaning window
  too, and the word-by-word meanings where there are some
- Report an issue or a suggestion from inside the site
- No third-party requests and no cookies; visits counted with self-hosted Umami

## Run it

```bash
npm install
npm run setup     # page fonts (~140 MB) and the page layout, one-off and resumable
npm start         # http://localhost:3000
```

Or run a copy of the site with Docker:

```bash
docker run -p 8080:80 ahmadanbarje/quran
```

[DOCKER.md](DOCKER.md) covers building it for your own domain.

## Where things are

| Path | What it holds |
|---|---|
| `public/` | The site as served: `index.html` is the one page template, plus `css/`, `js/` and `fonts/` |
| `public/surah/`, `public/juz/` | Generated pages, one per surah and juz, each with the surah's text, and its English (Hilali and Muhsin Khan), for search engines and screen readers |
| `public/surah/<s>/<a>/` | A page an ayah, 6236: the Arabic, the King Fahd Complex English, the Tafsir al-Muyassar and the words; its link opens the reader at the ayah's page (`/surah/<s>/?ayah=<a>`) |
| `public/data/` | The reader's data (below) |
| `scripts/` | Builders and importers: `build-pages.js`, `build-mushaf.js`, the font and timing tools |
| `qul/` | The QUL word-timing exports every timing file is built from |
| `tests/` | Data, font, speed and page checks, and the visual layout audit |
| `deploy/` | nginx, the pull-based deploy and the Umami setup |
| `feedback/` | The small service that receives issue reports |
| `mcp/` | The public MCP server, the Quran for AI assistants and developers (below) |
| `docs/` | How the type is set, the data, speed and testing in depth |

## The data

| File | What it is |
|---|---|
| `public/data/mushaf.json` | The 604 pages and their lines, with QCF V1 and V2 glyph codes |
| `public/data/surahs.json` | The 114-surah index, all the reader loads to start |
| `public/data/words/pN.json` | Each page's words as text, behind the glyphs, for search engines and screen readers |
| `public/data/recitations.json` | The reciters, and where their recordings are |
| `public/surah/N/NNN.<reciter>.timing.json` | When each word is recited, per surah and reciter |
| `public/data/quran-simple.txt` | The plain text the search runs on |
| `public/data/translit/N.json`, `meaning/N.json`, `meaning/<lang>/N.json` | Each word's Latin reading, its English, and its meaning in six more languages, per surah |
| `public/data/translations.json` | The translations on offer: language, translator, publisher |
| `public/data/translation/<id>/N.json` | Each translation, ayah by ayah; `hilali` (Hilali and Khan) is the default |
| `public/data/tafsir/muyassar/N.json` | Tafsir al-Muyassar, ayah by ayah |

The layout comes from [api.quran.com](https://api.quran.com) and is checked
against [Tanzil](https://tanzil.net) and [alquran.cloud](https://alquran.cloud);
the word timings come from [QUL](https://qul.tarteel.ai). Recordings are served
from `audio.readqurantoday.com`. [docs/data.md](docs/data.md) explains how the
pages, headers and Basmalahs are laid out.

## For developers and AI assistants

**MCP.** `https://readqurantoday.com/mcp` is a public, read-only
[Model Context Protocol](https://modelcontextprotocol.io) server, listed in the
[MCP Registry](https://registry.modelcontextprotocol.io) as `com.readqurantoday/quran`.
No key; 60 requests a minute an address, 50 ayahs a call.

- **Claude:** Settings → Connectors → Add custom connector, with the URL above and no sign-in
- **Claude Code:** `claude mcp add --transport http read-quran-today https://readqurantoday.com/mcp`
- **Gemini CLI:** `gemini mcp add --transport http read-quran-today https://readqurantoday.com/mcp`
- **VS Code:** in `.vscode/mcp.json`, `{"servers": {"read-quran-today": {"type": "http", "url": "https://readqurantoday.com/mcp"}}}`
- **Anything else** that speaks Streamable HTTP, or your own code

| Tool | Answers |
|---|---|
| `get_ayah` | The Arabic of an ayah or a run of them, in any of the translations, with its mushaf page and link |
| `search` | Ayahs containing words, in the Arabic (diacritics optional) or in a translation |
| `get_tafsir` | The Tafsir al-Muyassar of an ayah or a run |
| `word_by_word` | Each word's transliteration and meaning, in English and six more languages |
| `get_recitation` | A recording's MP3 link, its length, where each ayah starts, and a link that starts at one. In Claude it opens a player: the surah's Arabic, each ayah lit as it is recited, tap an ayah to go to it, change the reciter or the speed |
| `get_file` | Links to download a surah's files: its text as a `.txt` (with a translation or the tafsir if asked), its MP3 (or all 114 for a reciter), the recording's timing file, the mushaf's QCF V2 fonts for its pages with the glyphs each ayah is written in, or, for developers, the whole data sets (the Uthmani text, any translation or the tafsir in one file, the mushaf layout, word by word) with their sources |
| `send_feedback` | The reader's report of a problem or a suggestion, sent to the site's inbox when they ask; the one tool that is not read-only, so the assistant asks first |
| `list_surahs`, `list_translations`, `list_reciters` | What there is to ask for, and the ids |

Every ayah in an answer links to its own page on the site (`link`) and to the
reader opened at it, to read in the mushaf and listen (`read`).

The same data by address, for clients that read resources:
`quran://surah/{surah}`, `quran://translation/{id}/{surah}`,
`quran://tafsir/{surah}`, `quran://recitation/{reciter}/{surah}`. A translation
or reciter added to the site is offered there with no change to the server.

**Plain JSON.** Everything the reader loads is a static file, free to fetch:
`/data/surahs.json`, `/data/translations.json` and `/data/translation/<id>/<surah>.json`,
`/data/tafsir/muyassar/<surah>.json`, `/data/recitations.json` and
`/surah/<n>/<nnn>.<reciter>.timing.json`. Please credit the translators and
link back.

## Build and test

| Command | What it does |
|---|---|
| `npm run build:pages` | Regenerates the surah and juz pages, the sitemap and `robots.txt` from `public/index.html`; minifies the scripts and stylesheets beside their sources (`app.js` → `app.min.js`), which are the ones to edit |
| `python scripts/i18n-table.py` | Writes `public/i18n/<lang>.json`, the site's own words in the twelve languages beyond Arabic and English |
| `python scripts/i18n-keys.py` | Lists every English phrase the site shows, and how many each language still lacks |
| `python scripts/fetch-quranenc.py` | Downloads every QuranEnc translation of the meanings, and from Tanzil the languages QuranEnc lacks, checked ayah by ayah; one left incomplete is left out |
| `npm run fetch:translations` | Downloads Saheeh International, the tafsir and the words' English (one-off; checks the words line up with the Latin) |
| `npm run fetch:words` | Downloads the words' meanings in Urdu, Indonesian, Bengali, Turkish, Persian and Hindi from Quran.com, checked word by word against the Latin; a word it lacks shows in English |
| `npm run fetch:reference` | Downloads the reference texts the data checks compare against (one-off) |
| `npm test` | All checks: data, fonts, speed and pages |
| `npm run lint` | ESLint over the site's scripts, the tools, the tests and both services |
| `npm run test:browser` | The reader in Chromium: pages turn and draw (on a slow line too), the player and meaning window, the 14 languages, offline, accessibility (`npx playwright install chromium` once) |
| `cd mcp && npm test` | The MCP server, through the SDK's own client |
| `npm run sync:android` | Copies the reader's data into the native Android app |

The layout audit renders all 604 pages at a chosen screen size: start the
server and open <http://localhost:3000/tests/audit.html>.
[docs/testing.md](docs/testing.md) has what each check proves.

## Deploying

A static site behind nginx with no server side. Pushing to `main` runs the
checks; a green run moves the `release` branch, and the server pulls it within
a minute and clears Cloudflare's copy of the pages. [DEPLOY.md](DEPLOY.md) has
the setup.

## More

- [docs/typesetting.md](docs/typesetting.md) — page fonts, and how the type is sized
- [docs/data.md](docs/data.md) — how the layout is built
- [docs/speed.md](docs/speed.md) — what loads and when
- [docs/testing.md](docs/testing.md) — the checks, and how the marks are verified
- [docs/fonts.md](docs/fonts.md) — what lives in `public/fonts/`

## Credits

The mushaf typefaces are by the King Fahd Glorious Quran Printing Complex. Page
layout from Quran.com; reference texts from Tanzil and alquran.cloud; word
timings from QUL by Tarteel. The translations are from
[QuranEnc](https://quranenc.com), the Encyclopedia of the Noble Quran, each
credited to its translator or publisher as QuranEnc credits it. Saheeh
International, the languages QuranEnc lacks (Amazigh, Czech, Divehi, Norwegian,
Polish, Sindhi, Tatar) and the King Fahd Complex's Tafsir al-Muyassar are from
Tanzil. The
words' English is Quran.com's word-by-word data. The code is [MIT](LICENSE).
