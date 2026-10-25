"""
Every English phrase the site shows, the keys public/i18n/<lang>.json translate.

    python scripts/i18n-keys.py            lists them, and what each language lacks

The page's own (.lang-en elements and data-tip-en / data-ph-en in index.html),
the English halves of the scripts' T('…', '…') calls, and the lang-en spans the
scripts build. Numbers in "Juz 7" style phrases are one key, "Juz {n}".
"""
import glob
import json
import os
import re
import sys

from bs4 import BeautifulSoup

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
LANGS = ['ur', 'id', 'bn', 'tr', 'fr', 'fa', 'hi', 'ms', 'es', 'ru', 'de', 'zh']


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def keys():
    found = []
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    soup = BeautifulSoup(html, 'html.parser')
    for el in soup.select('.lang-en'):
        found.append(norm(el.decode_contents()))
    for el in soup.select('[data-tip-en]'):
        found.append(norm(el['data-tip-en']))
    for el in soup.select('[data-ph-en]'):
        found.append(norm(el['data-ph-en']))

    lit = r"'((?:[^'\\]|\\.)*)'"
    for js in glob.glob(os.path.join(ROOT, 'js', '*.js')):
        src = open(js, encoding='utf-8').read()
        for m in re.finditer(r"\bT\(\s*" + lit + r"\s*,\s*" + lit, src):
            found.append(norm(m.group(2).replace("\\'", "'")))
        for m in re.finditer(r'class="lang-en">((?:(?!</span>)[^\'])*)</span>', src):
            found.append(norm(m.group(1)))
        # The feedback and settings words kept in tables: { ar: '…', en: '…' }
        for m in re.finditer(r"\ben:\s*" + lit, src):
            found.append(norm(m.group(1).replace("\\'", "'")))
        for m in re.finditer(r"\ben:\s*\{([^}]*)\}", src):
            for v in re.finditer(r":\s*" + lit, m.group(1)):
                found.append(norm(v.group(1)))

    # Built from objects or data rather than written as T('…', '…')
    found += ['ayah', 'range', 'surah', 'Alharamain', '{n} AH', 'Murattal']

    out, seen = [], set()
    for k in found:
        k = re.sub(r'\b\d+\b', '{n}', k) if re.fullmatch(r'(Juz|Page|page) \d+', k) else k
        if k and k not in seen and re.search(r'[A-Za-z]', k):
            seen.add(k)
            out.append(k)
    return out


if __name__ == '__main__':
    ks = keys()
    print(len(ks), 'phrases')
    for code in LANGS:
        p = os.path.join(ROOT, 'i18n', code + '.json')
        have = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
        lack = [k for k in ks if k not in have]
        print(code, 'lacks', len(lack))
    if '--list' in sys.argv:
        json.dump(ks, sys.stdout, ensure_ascii=False, indent=0)
