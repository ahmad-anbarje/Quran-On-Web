<p align="center">
  <img src="public/icon-512.png" width="110" alt="">
</p>

<h1 align="center">القرآن الكريم — Read Quran Today</h1>

<p align="center">
  The Madinah Mushaf on the web, page for page, with recitation that highlights each word as it is read.
</p>

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.readqurantoday.quran"><img src="public/badges/google-play-en.png" alt="Get it on Google Play" height="60"></a>
</p>

<p align="center">
  <a href="https://readqurantoday.com"><img src="https://img.shields.io/badge/Website-readqurantoday.com-1a6fa3?style=for-the-badge&amp;logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCcgZmlsbD0nbm9uZScgc3Ryb2tlPSd3aGl0ZScgc3Ryb2tlLXdpZHRoPScyJyBzdHJva2UtbGluZWNhcD0ncm91bmQnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiLz48cGF0aCBkPSJNMyAxMmgxOE0xMiAzYzIuNSAyLjYgMi41IDE1LjQgMCAxOE0xMiAzYy0yLjUgMi42LTIuNSAxNS40IDAgMTgiLz48L3N2Zz4=" alt="Website: readqurantoday.com"></a>
  <a href="https://hub.docker.com/r/ahmadanbarje/quran"><img src="https://img.shields.io/badge/Docker%20Hub-ahmadanbarje%2Fquran-2496ED?style=for-the-badge&amp;logo=docker&amp;logoColor=white" alt="Docker Hub: ahmadanbarje/quran"></a>
  <a href="https://hub.docker.com/r/ahmadanbarje/quran"><img src="https://img.shields.io/docker/pulls/ahmadanbarje/quran?style=for-the-badge&amp;logo=docker&amp;logoColor=white&amp;label=pulls" alt="Docker pulls"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-555555?style=for-the-badge" alt="MIT licence"></a>
</p>

## Features

**Reading**
- The Madinah Mushaf page by page, 15 lines to a page, at one type size throughout
- One page at a time, or two facing as the mushaf opens on wide screens
- Zoom and a magnifier, full screen, three text weights, a page dimmer
- A running head on every page: juz, surah and page number

**Listening**
- Four reciters in five recordings, with each word highlighted as it is recited
- The word being recited spelled out in Latin letters (transliteration)
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
- Offline reading, installable, dark and light, Arabic and English
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
| `public/surah/`, `public/juz/` | Generated pages, one per surah and juz, each with the surah's text for search engines |
| `public/data/` | The reader's data (below) |
| `scripts/` | Builders and importers: `build-pages.js`, `build-mushaf.js`, the font and timing tools |
| `qul/` | The QUL word-timing exports every timing file is built from |
| `tests/` | Data, font, speed and page checks, and the visual layout audit |
| `deploy/` | nginx, the pull-based deploy and the Umami setup |
| `feedback/` | The small service that receives issue reports |
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

The layout comes from [api.quran.com](https://api.quran.com) and is checked
against [Tanzil](https://tanzil.net) and [alquran.cloud](https://alquran.cloud);
the word timings come from [QUL](https://qul.tarteel.ai). Recordings are served
from `audio.readqurantoday.com`. [docs/data.md](docs/data.md) explains how the
pages, headers and Basmalahs are laid out.

## Build and test

| Command | What it does |
|---|---|
| `npm run build:pages` | Regenerates the surah and juz pages, the sitemap and `robots.txt` from `public/index.html` |
| `npm run fetch:reference` | Downloads the reference texts the data checks compare against (one-off) |
| `npm test` | All checks: data, fonts, speed and pages |
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
timings from QUL by Tarteel. The code is [MIT](LICENSE).
