/**
 * The reader in a real browser: does it work, not only does it weigh right.
 *
 * Starts the real server on a spare port, opens it in Chromium the way a
 * reader would, on a wide screen and on a phone, and goes through what a
 * reader does: open a surah, turn pages, open the player and the meaning
 * window, read it in each of the fourteen languages, switch language, read
 * offline. Any script error fails it, and so does an accessibility fault
 * axe rates serious or critical.
 *
 * Run with: npm run test:browser
 * (once, to fetch the browser: npx playwright install chromium; or point
 * CHROME_PATH at a Chrome already installed)
 *
 * The recordings and Cloudflare's country lookup are on other hosts or not
 * there locally, so requests to them are let fail; nothing here waits on them.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const LANGS = ['ar', 'en', 'ur', 'id', 'bn', 'tr', 'fr', 'fa', 'hi', 'ms', 'es', 'ru', 'de', 'zh'];
const RTL = new Set(['ar', 'ur', 'fa']);

const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const results = [];
let failed = 0;

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((detail) => results.push({ ok: true, name, detail: detail || '' }))
    .catch((err) => { failed++; results.push({ ok: false, name, detail: err.message.split('\n')[0] }); });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/* Errors that are the page's fault: the off-host recordings, Cloudflare's
   lookup and the like failing to load are this machine's network, not it. */
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function main() {
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), NO_OPEN: '1' }, stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { await fetch(base + '/data/surahs.json'); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }

  /* CHROME_PATH names a browser already on the machine, as CI uses the
     runner's own Chrome; otherwise Playwright's */
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

  /* A fresh visitor, optionally with the site set to a language */
  async function visit(shape, lang, extra = {}) {
    const ctx = await browser.newContext({ ...shape, ...extra });
    // Set once, as a reader's own choice would be, so a reload keeps whatever they change it to
    if (lang) {
      await ctx.addInitScript((l) => {
        try {
          if (!sessionStorage.getItem('seeded')) { localStorage.setItem('quran-lang', l); sessionStorage.setItem('seeded', '1'); }
        } catch (e) { /* none */ }
      }, lang);
    }
    const page = await ctx.newPage();
    return { ctx, page, errors: watch(page) };
  }

  async function open(page, p) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('.m-word').length > 20 || !/^\/surah\//.test(location.pathname), null, { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const o = document.getElementById('overlay'); if (o && getComputedStyle(o).display !== 'none') o.click(); });
  }

  /* The visible pages, and whether each has its font */
  const drawn = (page) => page.evaluate(() => [...document.querySelectorAll('.page-section')]
    .filter((s) => { const r = s.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; })
    .map((s) => ({ page: +s.dataset.page, font: !!(s.querySelector('.mushaf') || {}).style?.fontFamily, words: s.querySelectorAll('.m-word').length })));

  /* Open the player on a word: a click with a mouse, a long press with a finger */
  async function pressWord(page, touch) {
    const w = page.locator('.m-word[data-a="2:2"][data-w="1"]').first();
    if (!touch) return w.click();
    const b = await w.boundingBox();
    const at = { bubbles: true, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2, pointerType: 'touch', isPrimary: true, pointerId: 1 };
    await w.dispatchEvent('pointerdown', at);
    await page.waitForTimeout(650);
    await w.dispatchEvent('pointerup', at);
  }

  try {
    for (const [label, shape] of [['wide screen', DESKTOP], ['phone', PHONE]]) {
      await check(`${label}: the index and a surah open, and pages turn, with no errors`, async () => {
        const { ctx, page, errors } = await visit(shape, 'en');
        await page.goto(base + '/', { waitUntil: 'networkidle' });
        const surahs = await page.$$eval('#surah-list a', (a) => a.length);
        assert(surahs === 114, `the index lists ${surahs} surahs`);
        await open(page, '/surah/2/');
        let seen = await drawn(page);
        assert(seen.length && seen.every((s) => s.font && s.words > 20), `pages not drawn: ${JSON.stringify(seen)}`);
        if (shape === DESKTOP) {
          const first = seen[0].page;
          for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(450); }
          seen = await drawn(page);
          assert(seen[0].page > first && seen.every((s) => s.font && s.words > 20), `after turning: ${JSON.stringify(seen)}`);
        }
        assert(!errors.length, errors.join(' | '));
        await ctx.close();
        return `page${seen.length > 1 ? 's' : ''} ${seen.map((s) => s.page).join(', ')} drawn`;
      });

      await check(`${label}: the player and the meaning window`, async () => {
        const { ctx, page, errors } = await visit(shape, 'en');
        await open(page, '/surah/2/');
        await pressWord(page, shape === PHONE);
        await page.waitForTimeout(600);
        assert(await page.evaluate(() => !document.getElementById('r-menu').hidden), 'the player did not open on a word');
        await page.click(shape === PHONE ? '#r-menu .r-dock [data-act="meaning"]' : '#r-menu .r-acts [data-act="meaning"]');
        await page.waitForFunction(() => { const t = document.querySelector('#meaning .mn-text'); return t && t.textContent.length > 20 && !/Loading/.test(t.textContent); }, null, { timeout: 10000 });
        const first = await page.$eval('#meaning .mn-text', (t) => t.textContent);
        await page.click('#meaning .mn-tab:not(.on)');
        await page.waitForTimeout(500);
        const other = await page.$eval('#meaning .mn-text', (t) => t.textContent);
        assert(other && other !== first, 'the other tab shows nothing new');
        const box = await page.$eval('#meaning', (m) => { const r = m.getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; });
        assert(box[0] >= 0 && box[1] <= box[2] + 1, `the window runs off the screen: ${box}`);
        await page.click('#meaning .mn-close');
        assert(await page.evaluate(() => document.getElementById('meaning').hidden), 'the window did not close');
        assert(!errors.length, errors.join(' | '));
        await ctx.close();
        return 'opens on a word, both tabs read, stays on screen, closes';
      });
    }

    /* Fonts for every page flipped past were fetched at once, and the pages
       stopped on came in last: half a minute of blank sheets on a modest line */
    await check('clicking fast on a slow connection: the pages stopped on draw soon after', async () => {
      const { ctx, page, errors } = await visit(DESKTOP, 'en');
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 250, downloadThroughput: 400 * 1024, uploadThroughput: 100 * 1024 });
      await open(page, '/surah/2/');
      for (let i = 0; i < 20; i++) { await page.click('#btn-page-next', { timeout: 2000 }).catch(() => {}); await page.waitForTimeout(80); }
      const t0 = Date.now();
      let seen = [];
      while (Date.now() - t0 < 10000) {
        seen = await drawn(page);
        if (seen.length && seen.every((x) => x.font)) break;
        await page.waitForTimeout(200);
      }
      assert(seen.length && seen.every((x) => x.font), `still blank 10 s after the last click: ${JSON.stringify(seen)}`);
      assert(!errors.length, errors.join(' | '));
      await ctx.close();
      return `20 clicks at 3 Mbit/s, pages ${seen.map((x) => x.page).join(', ')} drawn ${((Date.now() - t0) / 1000).toFixed(1)} s after`;
    });

    await check('all fourteen languages: no errors, direction, translated settings', async () => {
      const wrong = [];
      for (const lang of LANGS) {
        const { ctx, page, errors } = await visit(DESKTOP, lang);
        await open(page, '/surah/36/');
        const st = await page.evaluate(() => ({
          lang: document.documentElement.lang, dir: document.documentElement.dir,
          settings: (document.querySelector('.drawer-tab[data-pane="settings"] .lang-en') || {}).textContent || '',
        }));
        if (st.lang !== lang) wrong.push(`${lang}: html lang is ${st.lang}`);
        if (st.dir !== (RTL.has(lang) ? 'rtl' : 'ltr')) wrong.push(`${lang}: dir is ${st.dir}`);
        if (!['ar', 'en'].includes(lang) && st.settings.trim() === 'Settings') wrong.push(`${lang}: "Settings" left in English`);
        if (errors.length) wrong.push(`${lang}: ${errors[0]}`);
        await ctx.close();
      }
      assert(!wrong.length, wrong.join(' | '));
      return `${LANGS.length} languages, ${[...RTL].join(', ')} right to left`;
    });

    await check('the language is switched from Settings, and kept', async () => {
      const { ctx, page, errors } = await visit(DESKTOP, 'en');
      // The index, where Settings is on screen, rather than a surah, which puts it away
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelector('.drawer-tab[data-pane="settings"]').click());
      await page.click('#btn-lang');
      await page.click('#lang-list [data-code="fr"]');
      await page.waitForFunction(() => document.documentElement.lang === 'fr', null, { timeout: 5000 });
      await page.reload({ waitUntil: 'networkidle' });
      const lang = await page.evaluate(() => document.documentElement.lang);
      assert(lang === 'fr', `after a reload the site is in ${lang}`);
      assert(!errors.length, errors.join(' | '));
      await ctx.close();
      return 'English to French, still French after a reload';
    });

    await check('with offline reading on, a surah opens with no connection', async () => {
      const { ctx, page } = await visit(DESKTOP, 'en');
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelector('.drawer-tab[data-pane="settings"]').click());
      await page.click('#btn-offline');
      await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 });
      await open(page, '/surah/1/');
      await ctx.setOffline(true);
      await page.goto(base + '/surah/1/');
      await page.waitForFunction(() => document.querySelectorAll('.m-word').length > 20, null, { timeout: 15000 });
      await ctx.close();
      return 'Al-Fatihah drawn with the network off';
    });

    await check('accessibility: nothing serious or critical', async () => {
      const found = [];
      for (const [label, shape, scheme] of [['wide, light', DESKTOP, 'light'], ['phone, dark', PHONE, 'dark']]) {
        const { ctx, page } = await visit(shape, 'en', { colorScheme: scheme, bypassCSP: true });
        for (const p of ['/', '/surah/2/', '/juz/30/', '/surah/1/text/', '/privacy/']) {
          await page.goto(base + p, { waitUntil: 'networkidle' });
          await page.waitForTimeout(700);
          await page.addScriptTag({ content: AXE });
          const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
            .filter((x) => x.impact === 'serious' || x.impact === 'critical')
            .map((x) => `${x.id} (${x.nodes.length})`));
          v.forEach((x) => found.push(`${label} ${p}: ${x}`));
        }
        await ctx.close();
      }
      assert(!found.length, found.join(' | '));
      return 'five pages, light and dark, wide and phone';
    });

    await check('a surah page carries its text for search engines', async () => {
      const html = await (await fetch(base + '/surah/36/')).text();
      assert((html.match(/<h1[\s>]/g) || []).length === 1, 'not exactly one h1');
      assert(html.includes('<link rel="canonical" href="https://readqurantoday.com/surah/36/"'), 'canonical does not name the page');
      assert(html.includes('Surah Ya-Sin in English'), 'no English text');
      return 'one h1, its canonical, its Arabic and English';
    });
  } finally {
    await browser.close();
    server.kill();
  }

  console.log('\nIn the browser\n');
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (r.detail) console.log(`        ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed.\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error('\nERROR:', err.message); process.exit(1); });
