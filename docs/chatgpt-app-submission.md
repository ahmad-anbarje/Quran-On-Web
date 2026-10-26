# Read Quran Today: ChatGPT app submission

What to enter at <https://platform.openai.com/plugins> → **Upload new or existing
plugin** → **With MCP**. Requirements:
<https://developers.openai.com/apps-sdk/deploy/submission>.

## The package

`integrations/chatgpt/` is the upload, zipped from inside the folder (so
`.codex-plugin/plugin.json` sits at the root of the zip): the manifest with the
listing and the test cases below, `.mcp.json` with the server, and the icons.
Set `demo_recording_url` in the manifest once the video is up, zip, upload.

## Before you start (yours to do)

- **Verify the OpenAI organization** (individual or business), in organization
  settings, so the app is published under your name.
- **Record a demo video** (1–2 minutes, a public or unlisted link reviewers can
  open): ChatGPT with the connector on, asking the five positive prompts below,
  each answer showing the ayah's Arabic, its translation and its link.
- **Domain check:** the portal gives a token. Put it, alone, in
  `public/.well-known/openai-apps-challenge`, push, and click verify there
  (nginx already serves `/.well-known/`).

## Connection

- MCP server URL: `https://readqurantoday.com/mcp`
- Authentication: **None** (public, read-only data; no API key)

## Listing

| Field | Value |
|---|---|
| name | `read-quran-today` |
| displayName (≤30) | `Read Quran Today` |
| shortDescription (≤30) | `The Quran: text, audio, tafsir` |
| category | Education |
| developerName | Read Quran Today |
| websiteURL | https://readqurantoday.com |
| supportURL | https://readqurantoday.com/terms/#contact (the email, readqurantoday@outlook.com, on an HTTPS page as the form requires) |
| privacyPolicyURL | https://readqurantoday.com/privacy/ |
| termsOfServiceURL | https://readqurantoday.com/terms/ |
| logo | `public/icon-512.png` (512×512 PNG) |

**longDescription** (≤4000):

> Read Quran Today gives ChatGPT the text of the Holy Quran as printed in the Madinah Mushaf (Hafs), so it can quote ayahs exactly instead of from memory.
>
> Ask for any ayah or run of ayahs and get the Arabic with its mushaf page and links to read and hear it on readqurantoday.com, in any of 127 translations in 88 languages: Saheeh International, Hilali and Khan, and the translations published by QuranEnc and Tanzil, each credited to its translator. Search the Arabic (with or without diacritics) or a translation. Read the Tafsir al-Muyassar of an ayah, and each word's transliteration and meaning in English and six more languages. Find a reciter's recording of a surah, with where each ayah starts, and download a surah as text or audio.
>
> Free and open: no account, no key, no advertising, and nothing about you is kept.

## Tools

Nine read-only (`readOnlyHint: true`): `get_ayah`, `search`, `get_tafsir`,
`word_by_word`, `get_recitation`, `get_file`, `list_surahs`,
`list_translations`, `list_reciters`. One that sends, only when the reader asks:
`send_feedback` (`readOnlyHint: false`, `destructiveHint: false`).

## Test cases (exactly 5 positive, 3 negative)

### Positive

1. **Prompt:** "Show me Ayat al-Kursi in Arabic with the Saheeh International translation."
   **tools_triggered:** `get_ayah`
   **expected_behavior:** Quotes 2:255 in Arabic exactly as returned, with the Saheeh International English, mushaf page 42, and the link https://readqurantoday.com/surah/2/255/.
2. **Prompt:** "Which ayahs of the Quran mention patience? Give me the first five with references."
   **tools_triggered:** `search`
   **expected_behavior:** Searches a translation for "patience" and lists five ayahs with their references (e.g. 2:45, 2:153) and links.
3. **Prompt:** "Explain Surah Al-Ikhlas word by word in Urdu."
   **tools_triggered:** `word_by_word` (and `get_ayah` for the text)
   **expected_behavior:** For each of the four ayahs of surah 112, gives each word's transliteration and its Urdu meaning.
4. **Prompt:** "What does the Tafsir al-Muyassar say about the first ayah of Surah Al-Fatiha?"
   **tools_triggered:** `get_tafsir`
   **expected_behavior:** Quotes the Arabic tafsir of 1:1 as returned, credited to the King Fahd Complex, with the link.
5. **Prompt:** "Give me Surah Ya-Sin recited by Mishari al-Afasy, starting at ayah 12."
   **tools_triggered:** `list_reciters`, `get_recitation`
   **expected_behavior:** Gives the MP3 link for surah 36 by Mishari Rashid al-Afasy and a link that starts at ayah 12.

### Negative

1. **Prompt:** "What is the weather in Dubai today?"
   **expected_behavior:** No Read Quran Today tool is called.
2. **Prompt:** "Write me a short poem about the sea."
   **expected_behavior:** No Read Quran Today tool is called.
3. **Prompt:** "Translate 'good morning' into Arabic."
   **expected_behavior:** No Read Quran Today tool is called; this is not about the Quran.

## Reviewer instructions

No account or credentials are needed. Add `https://readqurantoday.com/mcp` with
no authentication and try the positive prompts above. Limits: 600 requests a
minute per address, 50 ayahs a call. Documentation:
https://github.com/ahmad-anbarje/Quran-On-Web#for-developers-and-ai-assistants
