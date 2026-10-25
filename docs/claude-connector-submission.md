# Read Quran Today: Claude Connectors Directory submission

What to paste into each step of the developer portal at
<https://claude.ai/directory/manage> → **Submit new** → **MCP connector**.
Requirements: <https://claude.com/docs/connectors/building/submission>.

## 1. Connection

- URL: `https://readqurantoday.com/mcp` (or pick the custom connector already added)
- Users connect to the same URL: yes, one URL

## 2. Tools

Synced from the server. All nine are read-only, each with a title and
`readOnlyHint: true`: `get_ayah`, `search`, `get_tafsir`, `word_by_word`,
`get_recitation`, `get_file`, `list_surahs`, `list_translations`, `list_reciters`.

## 3. Listing

- **Name:** Read Quran Today
- **One-liner** (≤200): The Holy Quran in the Madinah Mushaf: the Arabic, 127 translations in 88 languages, the Tafsir al-Muyassar, word-by-word meanings and recitations.
- **Description** (≤2,000):

  > Read Quran Today gives Claude the text of the Holy Quran as printed in the Madinah Mushaf (Hafs), so it can quote ayahs exactly instead of from memory.
  >
  > Ask for any ayah or run of ayahs and get the Arabic with its mushaf page and a link to read it on readqurantoday.com, in any of 127 translations in 88 languages: Saheeh International, Hilali and Khan, and the translations published by QuranEnc and Tanzil, each credited to its translator. Search the Arabic (with or without diacritics) or a translation. Read the Tafsir al-Muyassar of an ayah, and each word's transliteration and meaning in English and six more languages. Find a reciter's recording of a surah, with where each ayah starts.
  >
  > Read-only and open: no account, no key, and nothing about you is kept.

- **Categories:** Education; Reference (or the closest the portal offers)
- **Documentation URL:** https://github.com/ahmad-anbarje/Quran-On-Web#for-developers-and-ai-assistants
- **Privacy policy URL:** https://readqurantoday.com/privacy/
- **Support contact:** readqurantoday@outlook.com
- **Icon:** `public/icon-512.png` (512×512 PNG)
- **Slug:** `read-quran-today` (permanent once published)

## 4. Use cases

- Quote an ayah exactly, in Arabic and in a reader's language, with a link to it
- Find where a phrase or word occurs in the Quran
- Explain an ayah from the Tafsir al-Muyassar
- Study the Arabic word by word
- Find a recitation of a surah or the moment an ayah starts
- What users need: nothing; no account, plan or setup
- Data: reads only

## 5. Company

- Name: Read Quran Today
- Website: https://readqurantoday.com
- Primary contact: the site's owner, at readqurantoday@outlook.com

## 6. Authentication

- Authentication requirement: none (public, read-only data)

## 7. Data handling

- The API is our own: the server reads the site's own files
- No personal health data, no sponsored content

## 8. Test & launch

- Reviewer access: none needed. Add `https://readqurantoday.com/mcp` with no sign-in and call any tool, for example `get_ayah` with surah 2, ayah 255.
- Confirm each tool was run as a custom connector in Claude.

## 9. Compliance

The seven acknowledgments are the owner's to read and accept.

## Also listed in

The official MCP Registry as `com.readqurantoday/quran` (`mcp/server.json`),
verified by the key whose public half is `public/.well-known/mcp-registry-auth`.
To publish a new version: raise `version` in `mcp/server.json`, then

```bash
mcp-publisher login http --domain readqurantoday.com --private-key <hex key from the .pem>
mcp-publisher publish mcp/server.json
```

The private key is kept off the repository, at `C:\Users\ahmad\.mcp-registry\readqurantoday.pem`.
