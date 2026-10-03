# The Madinah Mushaf

The Quran as it is printed — whole pages in the QCF V2 fonts of the King Fahd
Complex, two at a time on a wide screen, one on a phone — with recitation that
follows the words. Nothing to configure.

```bash
docker run -p 8080:80 ahmadanbarje/quran
```

Then http://localhost:8080.

- **Site** — https://readqurantoday.com
- **Source** — https://github.com/ahmad-anbarje/Quran-On-Web
- **Android app** — https://github.com/ahmad-anbarje/Quran_Android
- **Detail** — [DOCKER.md](https://github.com/ahmad-anbarje/Quran-On-Web/blob/main/DOCKER.md)

## Tags

| tag | download | |
| --- | --- | --- |
| `latest` | 1.4 GB | reading, and one recitation — Maher al-Muaiqly |
| `slim` | 167 MB | reading only, no recitations at all |
| `full` | 7.0 GB | reading, and all five recitations |

## Inside

nginx and 604 page fonts. No Node at runtime, no database.

- 114 surahs, each also as plain text a search engine can read
- Search by surah name, page, juz, or the words of an ayah
- The word being recited is marked as it is read
- Recitation speed: 0.75×, 1×, 1.25×
- The Latin transliteration of each word, over the word being read or pointed at
- Any word played on its own, from word-by-word recordings
- Repeat an ayah, a range, or the surah
- Arabic and English interface, light and dark
- Reads offline once a page has been seen

## Your own domain

Every page carries the domain — canonical tag, sitemap, and the policy that
lets the recitations play — so it is set at build time, not run time. The
published tags say `localhost:8080`; for a real site, rebuild:

```bash
docker build -t quran --build-arg SITE=https://your.site .
```

Port 80, plain http. Put your own TLS in front of it.

## Sources

Quran text for search: Tanzil Project (CC BY 3.0). Page and surah-name fonts:
King Fahd Glorious Quran Printing Complex. Transliteration: Quran.com.
Word-by-word recitation: Tafsir Center for Quranic Studies, via Quran.com.
