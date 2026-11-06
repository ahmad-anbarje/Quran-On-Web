"""
Builds the reader's QCF v4 edition (King Fahd Complex, Madinah Mushaf 1441) from the Android app's v4 build.

  public/data/mushaf-v4.json   the 604 pages line by line, each word as its v4 glyph
  public/fonts/v4/p<page>.woff2  each page's glyphs cut from its v4 font (one font holds some 13 pages)
  public/fonts/v4/pb.woff2      every surah's own Basmalah, from the font that holds them

v4 prints the same pages as v2 (each opens and closes on the same ayah, with the same words) but
breaks some lines differently; tests/check-data.js holds the two together.

Usage: python scripts/build-qcf4.py [Android app's src/main, default ../Quran_Android/app/src/main]
  Its data/fonts come from tools/qcf4_build.py there (npm quran-qcf4 and the KFGQPC v4 fonts).
"""
import io
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'Quran_Android', 'app', 'src', 'main')
OUT_FONTS = os.path.join(ROOT, 'public', 'fonts', 'v4')
OUT_DATA = os.path.join(ROOT, 'public', 'data', 'mushaf-v4.json')

app = json.load(open(os.path.join(SRC, 'assets', 'data', 'mushaf.json'), encoding='utf-8'))
v2 = json.load(open(os.path.join(ROOT, 'public', 'data', 'mushaf.json'), encoding='utf-8'))
fonts = {}


def font(n):
    if n not in fonts:
        fonts[n] = os.path.join(SRC, 'fonts-qcf4', f'q{n}.ttf')
    return fonts[n]


def cut(n, codes, out):
    """The glyphs for these codes, and nothing else, from v4 font n, as WOFF2"""
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.notdef_outline = True
    opts.name_IDs = ['*']
    f = TTFont(font(n))
    missing = [c for c in codes if c not in f.getBestCmap()]
    assert not missing, (out, n, missing[:5])
    s = subset.Subsetter(opts)
    s.populate(unicodes=codes)
    s.subset(f)
    b = io.BytesIO()
    f.flavor = 'woff2'
    f.save(b)
    open(os.path.join(OUT_FONTS, out), 'wb').write(b.getvalue())
    return len(b.getvalue())


os.makedirs(OUT_FONTS, exist_ok=True)
glyphs = lambda s: {ord(c) for c in s if c not in '| '}
total, bas = 0, set()
for p in range(1, 605):
    rows = app['pages'][str(p)]
    codes = set()
    for r in rows:
        if r['t'] == 'ayah':
            codes |= glyphs(r['v4'])
        elif r['t'] == 'basmalah':
            bas |= glyphs(r['v4'])
    total += cut(app['fonts'][p - 1], sorted(codes), f'p{p}.woff2')
total += cut(app['basmalah']['font'], sorted(bas), 'pb.woff2')


def drawn(word):
    """A word's glyphs as a browser draws them, left to right: the app's data keeps reading order, right to
    left, and a pause mark (no advance) or a hizb or sajdah sign must start at the word's left edge"""
    return word[::-1]


pages = {}
for p in range(1, 605):
    pages[str(p)] = [{**r, 'v4': '|'.join(drawn(w) for w in r['v4'].split('|'))} if r['t'] == 'ayah' else r
                     for r in app['pages'][str(p)]]

# The reader's shape: the Basmalah drawn from its own face ("page" b), each Basmalah line with its glyph
data = {
    'fit': app['fit'],
    'juzPages': v2['juzPages'],
    'basmalah': {'page': 'b'},
    'pages': pages,
    'marks': app['marks'],
}
json.dump(data, open(OUT_DATA, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
print(f'v4: 604 page fonts and the Basmalah, {total / 1e6:.1f} MB; {os.path.getsize(OUT_DATA) / 1e3:.0f} KB of data')
