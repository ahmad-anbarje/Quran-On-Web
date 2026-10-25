"""
Translations of the meanings from QuranEnc, the Encyclopedia of the Noble Quran.

    python scripts/fetch-quranenc.py

Every translation QuranEnc lists, less its tafsir editions (Al-Mukhtasar, As-Sa'di,
Al-Muyassar, the Arabic tafsirs): those are commentary, not a translation. Each
is QuranEnc's own SQLite download, one row an ayah, written as

    public/data/translation/<id>/<n>.json    one array a surah, one string an ayah

and listed in public/data/translations.json with the credit QuranEnc gives it,
in English and Arabic. A translation is only marked as the King Fahd Complex's
where QuranEnc says so. Footnotes are left out: the marks that point at them
([1], [١], ...) are taken out of the text, and nothing else in it is changed.

Saheeh International and the tafsir come from Tanzil (fetch-translations.js);
this keeps their entries and replaces everything else in the list.
"""
import json
import os
import re
import sqlite3
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DATA = os.path.join(ROOT, 'public', 'data')
SITE = 'https://quranenc.com'
CACHE = os.path.join(tempfile.gettempdir(), 'quranenc-cache')

# Tafsir editions, not translations of the meanings
TAFSIR = re.compile(r'mokhtasar|saadi|moyassar|^arabic_')

# The ids the reader already knows, so a remembered choice still finds its translation
KEPT_IDS = {
    'english_hilali_khan': 'hilali', 'afar_hamza': 'aa-hamza', 'bengali_zakaria': 'bn-zakaria',
    'french_hameedullah': 'fr-hamidullah', 'indonesian_complex': 'id-complex',
    'iranun_sarro': 'ilp-saromintang', 'korean_hamid': 'ko-choi', 'kyrgyz_hakimov': 'ky-hakimov',
    'malayalam_kunhi': 'ml-madani', 'telugu_muhammad': 'te-moulana', 'thai_complex': 'th-complex',
}
# Translations kept from Tanzil, which this script does not own
TANZIL = {'sahih'}

# Languages QuranEnc does not have, from Tanzil: its own credit, its language in Arabic
TANZIL_MORE = {
    'ber.mensur': ('ber', 'Amazigh', 'الأمازيغية', 'Tamaziɣt', 'Ramdane At Mansour', 'رمضان آيت منصور'),
    'cs.hrbek': ('cs', 'Czech', 'التشيكية', 'Čeština', 'Ivan Hrbek', 'إيفان هربك'),
    'cs.nykl': ('cs', 'Czech', 'التشيكية', 'Čeština', 'A. R. Nykl', 'ألويس ريتشارد نيكل'),
    'dv.divehi': ('dv', 'Divehi', 'الديفيهية', 'ދިވެހި', 'Office of the President of Maldives', 'مكتب رئيس جمهورية المالديف'),
    'ku.asan': ('ckb', 'Kurdish', 'الكردية', 'کوردی', 'Burhan Muhammad-Amin', 'برهان محمد أمين'),
    'no.berg': ('no', 'Norwegian', 'النرويجية', 'Norsk', 'Einar Berg', 'أينار بيرغ'),
    'pl.bielawskiego': ('pl', 'Polish', 'البولندية', 'Polski', 'Józef Bielawski', 'يوزف بيلافسكي'),
    'sd.amroti': ('sd', 'Sindhi', 'السندية', 'سنڌي', 'Taj Mehmood Amroti', 'تاج محمود أمروتي'),
    'tt.nugman': ('tt', 'Tatar', 'التتارية', 'Татарча', 'Yakub Ibn Nugman', 'يعقوب بن نعمان'),
}


def tanzil_rows(tid):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, f'tanzil-{tid}.txt')
    if not os.path.exists(f) or os.path.getsize(f) == 0:
        data = get(f'https://tanzil.net/trans/?transID={tid}&type=txt-2')
        with open(f, 'wb') as out:
            out.write(data)
    rows = []
    for line in open(f, encoding='utf-8'):
        if line.startswith('#') or '|' not in line:
            continue
        sura, aya, text = line.rstrip('\n').split('|', 2)
        rows.append((int(sura), int(aya), text))
    return rows

ISO = {
    'afar': 'aa', 'albanian': 'sq', 'amharic': 'am', 'ankobambara': 'nqo', 'asante': 'ak',
    'assamese': 'as', 'azeri': 'az', 'belarusian': 'be', 'bengali': 'bn', 'bisayan': 'ceb',
    'bosnian': 'bs', 'bulgarian': 'bg', 'chichewa': 'ny', 'chinese': 'zh', 'circassian': 'ady',
    'croatian': 'hr', 'dagbani': 'dag', 'dari': 'prs', 'dutch': 'nl', 'english': 'en',
    'french': 'fr', 'fulani': 'ff', 'georgian': 'ka', 'german': 'de', 'greek': 'el',
    'gujarati': 'gu', 'hausa': 'ha', 'hebrew': 'he', 'hindi': 'hi', 'ikirundi': 'rn',
    'indonesian': 'id', 'iranun': 'ilp', 'italian': 'it', 'japanese': 'ja', 'kannada': 'kn',
    'kazakh': 'kk', 'khmer': 'km', 'kinyarwanda': 'rw', 'korean': 'ko', 'kurdish': 'ckb',
    'kurmanji': 'kmr', 'kyrgyz': 'ky', 'lingala': 'ln', 'lithuanian': 'lt', 'luganda': 'lg',
    'luhya': 'luy', 'macedonian': 'mk', 'maguindanao': 'mdh', 'malagasy': 'mg', 'malay': 'ms',
    'malayalam': 'ml', 'marathi': 'mr', 'moore': 'mos', 'nepali': 'ne', 'oromo': 'om',
    'pashto': 'ps', 'persian': 'fa', 'portuguese': 'pt', 'punjabi': 'pa', 'romanian': 'ro',
    'russian': 'ru', 'serbian': 'sr', 'shona': 'sn', 'sinhalese': 'si', 'somali': 'so',
    'spanish': 'es', 'swahili': 'sw', 'swedish': 'sv', 'tagalog': 'tl', 'tajik': 'tg',
    'tamil': 'ta', 'telugu': 'te', 'thai': 'th', 'turkish': 'tr', 'ukrainian': 'uk',
    'urdu': 'ur', 'uyghur': 'ug', 'uzbek': 'uz', 'vietnamese': 'vi', 'yaw': 'yao',
    'yoruba': 'yo', 'zulu': 'zu',
}

# QuranEnc calls all four "Filipino"; each is its own language, and one group in the list
OWN_NAME = {'ceb': ('Cebuano', 'السيبوانية'), 'ilp': ('Iranun', 'الإيرانونية'),
            'mdh': ('Maguindanao', 'الماجينداناوية'), 'tl': ('Tagalog', 'التاغالوغية')}

# Each language in its own words, so a reader finds theirs by the name they know it by
NATIVE = {
    'aa': 'Qafaraf', 'sq': 'Shqip', 'am': 'አማርኛ', 'nqo': 'ߒߞߏ', 'ak': 'Akan', 'as': 'অসমীয়া',
    'az': 'Azərbaycanca', 'be': 'Беларуская', 'bn': 'বাংলা', 'ceb': 'Binisaya', 'bs': 'Bosanski',
    'bg': 'Български', 'ny': 'Chichewa', 'zh': '中文', 'ady': 'Адыгабзэ', 'hr': 'Hrvatski',
    'dag': 'Dagbanli', 'prs': 'دری', 'nl': 'Nederlands', 'en': 'English', 'fr': 'Français',
    'ff': 'Fulfulde', 'ka': 'ქართული', 'de': 'Deutsch', 'el': 'Ελληνικά', 'gu': 'ગુજરાતી',
    'ha': 'Hausa', 'he': 'עברית', 'hi': 'हिन्दी', 'rn': 'Ikirundi', 'id': 'Bahasa Indonesia',
    'ilp': 'Iranun', 'it': 'Italiano', 'ja': '日本語', 'kn': 'ಕನ್ನಡ', 'kk': 'Қазақша', 'km': 'ខ្មែរ',
    'rw': 'Kinyarwanda', 'ko': '한국어', 'ckb': 'کوردی', 'kmr': 'Kurmancî', 'ky': 'Кыргызча',
    'ln': 'Lingála', 'lt': 'Lietuvių', 'lg': 'Luganda', 'luy': 'Luluhya', 'mk': 'Македонски',
    'mdh': 'Maguindanaon', 'mg': 'Malagasy', 'ms': 'Bahasa Melayu', 'ml': 'മലയാളം', 'mr': 'मराठी',
    'mos': 'Mooré', 'ne': 'नेपाली', 'om': 'Afaan Oromoo', 'ps': 'پښتو', 'fa': 'فارسی',
    'pt': 'Português', 'pa': 'ਪੰਜਾਬੀ', 'ro': 'Română', 'ru': 'Русский', 'sr': 'Српски',
    'sn': 'chiShona', 'si': 'සිංහල', 'so': 'Soomaali', 'es': 'Español', 'sw': 'Kiswahili',
    'sv': 'Svenska', 'tl': 'Tagalog', 'tg': 'Тоҷикӣ', 'ta': 'தமிழ்', 'te': 'తెలుగు', 'th': 'ไทย',
    'tr': 'Türkçe', 'uk': 'Українська', 'ur': 'اردو', 'ug': 'ئۇيغۇرچە', 'uz': 'Oʻzbekcha',
    'vi': 'Tiếng Việt', 'yao': 'Chiyao', 'yo': 'Yorùbá', 'zu': 'isiZulu',
}

# A footnote mark: a number in brackets, in any script's digits
MARK = re.compile(r'\s*\[\s*\d{1,3}\s*\]')
# Right-to-left scripts: Arabic, Hebrew, N'Ko
RTL = re.compile('[֐-׿؀-ۿݐ-ݿ߀-߿]')
COMPLEX = re.compile(r'King Fahd|King Fahad|Complex|مجمع الملك فهد', re.I)


# A heading set into the text in markup, as a rukuʿ's: not the ayah's meaning
TAGGED = re.compile(r'<(b|strong|h\d)>.*?</\1>|<[^>]+>', re.S)
# The ayah's own number at its head: "1.", "(1)", "2-1" (surah-ayah) or a bare "1 "
LEAD = re.compile(r'^[\s\u200e\u200f]*(?:\(\s*(\d+)\s*\)|(\d+)\s*-\s*(\d+)(?!\d)|(\d+)\s*[.\-)]|(\d+)(?=\s))\s*')


def lead(m, sura):
    """The ayah number a LEAD match gives; "151-152" is a range, kept, unless the first is the surah."""
    if not m:
        return None
    paren, s, b, dot, bare = m.groups()
    if s:
        return int(b) if int(s) == sura else None
    return int(paren or dot or bare)


# "[2.2]" at an ayah's head: its own reference, which the window already shows
REF = re.compile(r'^\s*\[\s*(\d+)\s*[.:]\s*(\d+)\s*\]\s*')
# Footnote numbers set against the word they annotate, with no brackets ("beriman13",
# "menginfakkan6)"). Only where a translation is known to write them so: elsewhere a
# number after a word can be the text's own.
GLUED = re.compile(r'(?<=[^\W\d_]|[)\]"”’\'!?.,;:`])\d{1,3}\)?(?=[\s,.;:!?"”’)]|$)')
GLUED_IN = {'indonesian_complex', 'indonesian_affairs'}


def clean(text, aya, sura=0, key=''):
    """The ayah's meaning, as QuranEnc gives it, less what points elsewhere: footnote marks,
    markup, and the ayah's own number or reference at its head, which the window already
    shows. A number at the head that is not this ayah's is the text's, and stays."""
    text = TAGGED.sub('', MARK.sub('', text or ''))
    m = REF.match(text)
    if m and int(m.group(1)) == sura and int(m.group(2)) == aya:
        text = text[m.end():]
    if key in GLUED_IN:
        text = GLUED.sub('', text)
    m = LEAD.match(text)
    while m and lead(m, sura) == aya:      # some carry it twice: "1. 1. ..."
        text = text[m.end():]
        m = LEAD.match(text)
    return re.sub(r'\s{2,}', ' ', text).strip()


def direction(texts):
    """Right to left where most of the letters are: a Latin text quotes Arabic now and then."""
    s = ''.join(texts)
    rtl = len(RTL.findall(s))
    ltr = sum(1 for ch in s if ch.isalpha()) - rtl
    return 'rtl' if rtl > ltr else 'ltr'


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'readqurantoday-import'})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1:
                raise RuntimeError(f'{url}: {e}')
            time.sleep(2 + 3 * i)


def keys():
    html = get(f'{SITE}/en/home').decode('utf-8')
    found = sorted(set(re.findall(r'/en/browse/([a-z0-9_]+)', html)))
    return [k for k in found if not TAFSIR.search(k)]


ARABIC = re.compile('[؀-ۿ]')


def credit(key):
    """QuranEnc's own words for a translation: its language and who it is by, in each script.

    A page's title runs "<surah> - <language> Translation (<variant>) - <by> - ... - Page Number 1";
    the variant joins the credit, so the list groups by the language itself. None where a page
    carries no title in that script (some English pages are titled only in Arabic)."""
    cached = os.path.join(CACHE, key + '.credit.json')
    if os.path.exists(cached):
        return {k: tuple(v) if v else None for k, v in json.load(open(cached, encoding='utf-8')).items()}
    out = {}
    for lang in ('en', 'ar'):
        html = get(f'{SITE}/{lang}/browse/{key}/1').decode('utf-8')
        parts = [p.strip() for p in re.search(r'<title>([^<]*)</title>', html).group(1).split(' - ')]
        middle = parts[1:-2]
        head = middle[0]
        m = (re.match(r'(.+?) Translation(?: \((.+)\))?$', head, re.I) if lang == 'en'
             else re.match(r'الترجمة (.+?)(?: \((.+)\))?$', head))
        if not m or (lang == 'en' and ARABIC.search(head)):
            out[lang] = None
            continue
        by = ' · '.join(middle[1:] + ([m.group(2)] if m.group(2) else []))
        out[lang] = (m.group(1).strip(), by)
    os.makedirs(CACHE, exist_ok=True)
    with open(cached, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    return out


def by_api(key):
    """The same rows from QuranEnc's API, a surah at a time: some translations have no download."""
    cached = os.path.join(CACHE, key + '.json')
    if not os.path.exists(cached):
        out = []
        for n in range(1, 115):
            for r in json.loads(get(f'{SITE}/api/v1/translation/sura/{key}/{n}'))['result']:
                out.append([int(r['sura']), int(r['aya']), r['translation']])
        with open(cached, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False)
    return [tuple(r) for r in json.load(open(cached, encoding='utf-8'))]


def rows(key):
    os.makedirs(CACHE, exist_ok=True)
    db = os.path.join(CACHE, key + '.sqlite')
    if os.path.exists(db) and os.path.getsize(db) == 0:
        os.remove(db)
    if not os.path.exists(db):
        try:
            data = get(f'{SITE}/downloads/sqlite/{key}.sqlite')
        except RuntimeError as e:
            if '404' not in str(e):
                raise
            return by_api(key)
        with open(db, 'wb') as f:
            f.write(data)
    con = sqlite3.connect(db)
    try:
        return con.execute('select sura, aya, translation from translations order by sura, aya').fetchall()
    finally:
        con.close()


def write_whole(tid, by, counts):
    """Writes a translation only if it is whole, in order, and nothing blank: one slip would
    put a meaning under the wrong ayah, and a reader would meet a blank one. Such a
    translation is left out, not patched; what is wrong with it is returned."""
    for n, v in counts.items():
        got = sorted(by.get(n, []))
        if [a for a, _ in got] != list(range(1, v + 1)):
            return f'surah {n} has {len(got)} ayahs, wants {v}'
        if any(not t for _, t in got):
            return f'surah {n} has an empty ayah'
    out = os.path.join(DATA, 'translation', tid)
    os.makedirs(out, exist_ok=True)
    for n in counts:
        with open(os.path.join(out, f'{n}.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump([t for _, t in sorted(by[n])], f, ensure_ascii=False, separators=(',', ':'))
    return None


def main():
    surahs = json.load(open(os.path.join(DATA, 'surahs.json'), encoding='utf-8'))
    counts = {s['id']: s['v'] for s in surahs}
    listed = json.load(open(os.path.join(DATA, 'translations.json'), encoding='utf-8'))
    catalogue = [t for t in listed if t['id'] in TANZIL]
    for t in catalogue:
        t['source'] = 'tanzil'
        t['language']['native'] = NATIVE[t['lang']]
    skipped = []

    for key in keys():
        by = {}
        for sura, aya, text in rows(key):
            by.setdefault(int(sura), []).append((int(aya), clean(text, int(aya), int(sura), key)))
        tid = KEPT_IDS.get(key, key)
        gap = write_whole(tid, by, counts)
        if gap:
            skipped.append(f'{key}: {gap}')
            print(f'skipped {key}: {gap}', flush=True)
            continue

        c = credit(key)
        if not c['ar']:
            raise SystemExit(f'{key}: no Arabic title to credit it by')
        name = {'en': c['en'][1] if c['en'] else c['ar'][1], 'ar': c['ar'][1]}
        # The Complex's editions: QuranEnc files them under "_complex", whoever it credits
        complex_ = key.endswith('_complex') or bool(COMPLEX.search(name['en'] + ' ' + name['ar']))
        if complex_ and name['ar'] in ('المجمع', 'مجمع الملك فهد'):
            name = {'en': 'King Fahd Complex', 'ar': 'مجمع الملك فهد'}
        iso = ISO[key.split('_')[0]]
        catalogue.append({
            'id': tid,
            'lang': iso,
            'dir': direction([t for _, t in by[1]] + [t for _, t in by[2][:20]]),
            'complex': complex_,
            # An English page titled only in Arabic: its language is named by its fellows below
            'language': {'en': c['en'][0] if c['en'] else None, 'ar': c['ar'][0], 'native': NATIVE[iso]},
            'name': name,
            'source': 'quranenc',
            'key': key,
        })
        print(f'{tid:24} {c["ar"][0]} · {c["ar"][1]}', flush=True)

    for key, (iso, en, ar, native, by_en, by_ar) in TANZIL_MORE.items():
        by = {}
        for sura, aya, text in tanzil_rows(key):
            by.setdefault(sura, []).append((aya, clean(text, aya, sura)))
        tid = 'tanzil-' + key.replace('.', '-')
        gap = write_whole(tid, by, counts)
        if gap:
            skipped.append(f'{key}: {gap}')
            print(f'skipped {key}: {gap}', flush=True)
            continue
        catalogue.append({
            'id': tid, 'lang': iso,
            'dir': direction([t for _, t in by[1]] + [t for _, t in by[2][:20]]),
            'complex': False,
            'language': {'en': en, 'ar': ar, 'native': native},
            'name': {'en': by_en, 'ar': by_ar},
            'source': 'tanzil', 'key': key,
        })
        print(f'{tid:24} {ar} · {by_ar}', flush=True)

    for t in catalogue:
        if t['language']['en'] is None:
            peer = next((p for p in catalogue if p.get('key', '').split('_')[0] == t['key'].split('_')[0]
                         and p['language']['en']), None)
            t['language']['en'] = peer['language']['en'] if peer else t['key'].split('_')[0].title()
        if t['lang'] in OWN_NAME:
            t['language']['en'], t['language']['ar'] = OWN_NAME[t['lang']]

    # English first, then by language, each language's own order kept
    first = {'hilali': 0, 'sahih': 1}
    catalogue.sort(key=lambda t: (t['language']['en'] != 'English', t['language']['en'], first.get(t['id'], 2)))
    with open(os.path.join(DATA, 'translations.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(catalogue, f, ensure_ascii=False, separators=(',', ':'))

    # Folders no longer in the list (a translation with no source left) go too
    kept = {t['id'] for t in catalogue}
    for d in os.listdir(os.path.join(DATA, 'translation')):
        if d not in kept:
            path = os.path.join(DATA, 'translation', d)
            for f in os.listdir(path):
                os.remove(os.path.join(path, f))
            os.rmdir(path)
            print(f'removed {d}: no source left', flush=True)
    print(f'{len(catalogue)} translations listed; {len(skipped)} left out as incomplete')
    for s in skipped:
        print('  ' + s)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
