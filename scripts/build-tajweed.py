"""
Builds the reader's Tajweed edition from the Android app's: the 1441 printing's lines, its words coloured by the
rules of Tajweed in colour fonts (COLR, a palette for light pages and one for dark).

  public/data/mushaf-tj.json    the 604 pages line by line, each word as its Tajweed glyph
  public/fonts/tj/p<page>.woff2  each page's font, as the app ships it, cut to the glyphs the page draws
  public/data/tajweed/p<page>.json  each word's rules, in the page's order, as bits of the legend's rows,
                                   read from the colours its glyph is painted in (the app's TajweedFonts)

The fonts number their glyphs as V2's, so a word is drawn as V2 drew it, left to right. Every page holds the same
words as v4 (tests/check-data.js), which the recitation lights by number.

Usage: python scripts/build-tajweed.py [Android app's src/main] [--fonts]
  default ../Quran_Android/app/src/main; the fonts are cut again only when asked or missing
  Its data and fonts come from tools/tajweed_build.py there.
"""
import io
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
SRC = ARGS[0] if ARGS else os.path.join(ROOT, '..', 'Quran_Android', 'app', 'src', 'main')
OUT_RULES = os.path.join(ROOT, 'public', 'data', 'tajweed')
# The legend's rows, in its order, by the palette slots each is painted from (the app's TajweedLegend RULES)
RULE_SLOTS = [{3}, {9}, {4}, {5}, {6}, {8}, {7}, {1, 2, 15}]
OUT_FONTS = os.path.join(ROOT, 'public', 'fonts', 'tj')
OUT_DATA = os.path.join(ROOT, 'public', 'data', 'mushaf-tj.json')

app = json.load(open(os.path.join(SRC, 'assets', 'data', 'mushaf-tajweed.json'), encoding='utf-8'))
v4 = json.load(open(os.path.join(ROOT, 'public', 'data', 'mushaf-v4.json'), encoding='utf-8'))
os.makedirs(OUT_FONTS, exist_ok=True)
os.makedirs(OUT_RULES, exist_ok=True)
CUT = '--fonts' in sys.argv or not os.path.exists(os.path.join(OUT_FONTS, 'p604.woff2'))

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
    cmap = f.getBestCmap()
    missing = codes - set(cmap)
    assert not missing, (p, sorted(missing)[:5])

    # Each drawn word's rules, the ayah numbers among them, in the order the page builds its words
    layers = f['COLR'].ColorLayers
    rules = []
    for r in rows:
        if r['t'] != 'ayah':
            continue
        for word in r['tj'].split('|'):
            slots = {l.colorID for c in word if c != ' ' for l in layers.get(cmap[ord(c)], [])}
            rules.append(sum(1 << i for i, s_ in enumerate(RULE_SLOTS) if s_ & slots))
    json.dump(rules, open(os.path.join(OUT_RULES, f'p{p}.json'), 'w', newline='\n'), separators=(',', ':'))
    if not CUT:
        continue

    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(codes))
    s.subset(f)
    assert 'COLR' in f and 'CPAL' in f, p
    b = io.BytesIO()
    f.flavor = 'woff2'
    f.save(b)
    open(os.path.join(OUT_FONTS, f'p{p}.woff2'), 'wb').write(b.getvalue())
    total += len(b.getvalue())

# The plain edition's ayah numbers, drawn as this edition's medallions (outline, ornament, disc, numerals in
# layers of their own) so the reader can paint them in the site's blues: each page's, in order, into
# mushaf-v4.json, and a font a page holding only them, public/fonts/tjb/p<page>.woff2
OUT_ENDS = os.path.join(ROOT, 'public', 'fonts', 'tjb')
os.makedirs(OUT_ENDS, exist_ok=True)
ends = {}
for p in range(1, 605):
    marks = app['marks'][str(p)]
    seq = [w for r in pages[str(p)] if r['t'] == 'ayah' for w in r['tj'].split('|') if w in marks]
    assert len(seq) == sum(1 for r in v4['pages'][str(p)] if r['t'] == 'ayah' for w in r['v4'].split('|') if w in v4['marks'].get(str(p), '')), p
    ends[str(p)] = ''.join(seq)
    out = os.path.join(OUT_ENDS, f'p{p}.woff2')
    if seq and (CUT or not os.path.exists(out)):
        f = TTFont(os.path.join(SRC, 'fonts-tajweed', f'tj{p}.otf'))
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=sorted({ord(c) for c in seq}))
        sub.subset(f)
        # One palette on every page, each layer named by its colour (outline, ornament, disc, numerals = 0-3)
        cpal = f['CPAL']
        hexes = ['#%02x%02x%02x' % (c.red, c.green, c.blue) for c in cpal.palettes[0]]
        role = {h: k for k, h in enumerate(['#2ca4ab', '#ff0080', '#d8e9d8', '#000000'])}
        first = {}
        for l in f['COLR'].ColorLayers.values():
            for x in l:
                k = role[hexes[x.colorID]]
                first.setdefault(k, x.colorID)
                x.colorID = k
        assert sorted(first) == [0, 1, 2, 3], p
        # The site's blues, built in (outline, ornament, disc, numerals); dark pages map them in CSS (#medal-dark) (outline, ornament, disc, numerals)
        from fontTools.ttLib.tables.C_P_A_L_ import Color
        rgb = lambda h: Color(red=int(h[1:3], 16), green=int(h[3:5], 16), blue=int(h[5:7], 16), alpha=255)
        cpal.numPaletteEntries = 4
        cpal.version = 0
        f.flavor = 'woff2'
        cpal.palettes = [[rgb(h) for h in ('#0d4a73', '#5aaedd', '#dbeefa', '#000000')]]
        f.save(out)
v4['ends'] = ends
json.dump(v4, open(os.path.join(ROOT, 'public', 'data', 'mushaf-v4.json'), 'w', encoding='utf-8', newline='\n'),
          ensure_ascii=False, separators=(',', ':'))

data = {
    'fit': {'body': {'tj': app['fit']['body']['v2']}, 'centreBelow': {'tj': app['fit']['centreBelow']['v2']}},
    'juzPages': v4['juzPages'],
    'basmalah': {'page': 1},
    'pages': pages,
    'marks': app['marks'],
}
json.dump(data, open(OUT_DATA, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
print(f'tajweed: 604 pages of rules' + (f', 604 page fonts, {total / 1e6:.1f} MB' if CUT else ', fonts kept') + f'; {os.path.getsize(OUT_DATA) / 1e3:.0f} KB of data')
