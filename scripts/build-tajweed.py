"""
Builds the reader's Tajweed edition from the Android app's: the 1441 printing's lines, its words coloured by the
rules of Tajweed in colour fonts (COLR, a palette for light pages and one for dark).

  public/data/mushaf-tj.json    the 604 pages line by line, each word as its Tajweed glyph
  public/fonts/tj/p<page>.woff2  each page's font, as the app ships it, cut to the glyphs the page draws

The fonts number their glyphs as V2's, so a word is drawn as V2 drew it, left to right. Every page holds the same
words as v4 (tests/check-data.js), which the recitation lights by number.

Usage: python scripts/build-tajweed.py [Android app's src/main, default ../Quran_Android/app/src/main]
  Its data and fonts come from tools/tajweed_build.py there.
"""
import io
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'Quran_Android', 'app', 'src', 'main')
OUT_FONTS = os.path.join(ROOT, 'public', 'fonts', 'tj')
OUT_DATA = os.path.join(ROOT, 'public', 'data', 'mushaf-tj.json')

app = json.load(open(os.path.join(SRC, 'assets', 'data', 'mushaf-tajweed.json'), encoding='utf-8'))
v4 = json.load(open(os.path.join(ROOT, 'public', 'data', 'mushaf-v4.json'), encoding='utf-8'))
os.makedirs(OUT_FONTS, exist_ok=True)

opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.notdef_outline = True
opts.name_IDs = ['*']
opts.drop_tables = []           # the colour tables, COLR and CPAL, are the edition

glyphs = lambda s: {ord(c) for c in s if c not in '| '}
total, pages = 0, {}
for p in range(1, 605):
    rows, codes = [], set()
    for r in app['pages'][str(p)]:
        if r['t'] == 'surah':
            rows.append(r)
            continue
        # The Basmalah's four words are page 1's, drawn from its font as the reader's other editions draw theirs
        rows.append({'t': r['t'], 'tj': r['v2']})
        if r['t'] == 'ayah' or p == 1:
            codes |= glyphs(r['v2'])
    if p == 1:
        codes |= glyphs(next(r['v2'] for p2 in range(2, 605) for r in app['pages'][str(p2)] if r['t'] == 'basmalah'))
    pages[str(p)] = rows

    f = TTFont(os.path.join(SRC, 'fonts-tajweed', f'tj{p}.otf'))
    missing = codes - set(f.getBestCmap())
    assert not missing, (p, sorted(missing)[:5])
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(codes))
    s.subset(f)
    assert 'COLR' in f and 'CPAL' in f, p
    b = io.BytesIO()
    f.flavor = 'woff2'
    f.save(b)
    open(os.path.join(OUT_FONTS, f'p{p}.woff2'), 'wb').write(b.getvalue())
    total += len(b.getvalue())

data = {
    'fit': {'body': {'tj': app['fit']['body']['v2']}, 'centreBelow': {'tj': app['fit']['centreBelow']['v2']}},
    'juzPages': v4['juzPages'],
    'basmalah': {'page': 1},
    'pages': pages,
    'marks': app['marks'],
}
json.dump(data, open(OUT_DATA, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
print(f'tajweed: 604 page fonts, {total / 1e6:.1f} MB; {os.path.getsize(OUT_DATA) / 1e3:.0f} KB of data')
