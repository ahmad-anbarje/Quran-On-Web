/**
 * public/js/dom.js against the jQuery it stands in for, side by side.
 *
 * The same calls, the way the site makes them, are run once with jQuery
 * 3.7.1 and once with dom.js, each on a fresh copy of the same markup, in
 * Chromium; what each returns, and what the markup looks like after, must
 * match.
 *
 * Run with: npm run test:dom
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const JQUERY = fs.readFileSync(path.join(__dirname, 'vendor', 'jquery-3.7.1.min.js'), 'utf8');
const LITE = fs.readFileSync(path.join(ROOT, 'public', 'js', 'dom.js'), 'utf8');

const MARKUP = `
  <div id="root" class="a b">
    <ul id="list">
      <li class="item on" data-page="7" data-id="12" data-list="surahs" data-flag="true" data-name="Al-Kahf">one</li>
      <li class="item" data-page="8" data-juz="2" data-a="2:255">two <b>bold</b></li>
      <li class="item hide">three</li>
    </ul>
    <input id="box" type="text" value=" hello " />
    <input id="tick" type="checkbox" checked />
    <button id="btn" class="x" aria-pressed="false">Press <span class="tip"><span>t</span><kbd>K</kbd></span></button>
    <p id="note" hidden>note</p>
  </div>`;

/* Each returns something comparable; the markup after each is compared too */
const CASES = {
  'select, length, get': () => [$('.item').length, $('#none').length, $('li').get().length, $('li').get(0).textContent],
  'html string': () => { const $b = $('<span class="made">x</span>'); return [$b.length, $b[0].outerHTML]; },
  'find, children, closest, filter, is': () => [
    $('#root').find('.item').length, $('#list').children('.on').length, $('#list').children().length,
    $('b').closest('li').text(), $('.item').filter('.on').length,
    $('.item').filter(function (i) { return i > 0; }).length, $('#box').is('input, textarea'), $('#btn').is('input'),
  ],
  'each and map': () => {
    const seen = [];
    $('.item').each(function (i) { seen.push(i + ':' + this.textContent.trim()); });
    return [seen, $('.item').map(function () { return this.dataset.page || null; }).get()];
  },
  'text and html': () => {
    const before = [$('.item').text(), $('#btn').html()];
    $('#note').text('<b>plain</b>');
    $('#list li:last-child').html('<i>made</i>');
    return before;
  },
  'val, trim': () => { const v = $('#box').val(); $('#box').val('set'); return [v, $.trim(v), $('#box').val(), $.trim(null)]; },
  'attr, removeAttr, prop': () => {
    const got = [$('#btn').attr('aria-pressed'), $('#btn').attr('nope'), $('#tick').prop('checked'), $('#note').prop('hidden')];
    $('#btn').attr('aria-pressed', 'true').attr({ 'data-code': 'fr', lang: 'fr' });
    $('#note').prop('hidden', false);
    $('#tick').prop('checked', false);
    $('#btn').removeAttr('lang');
    return got.concat([$('#tick').prop('checked')]);
  },
  'classes': () => {
    $('#root').addClass('c d').removeClass('a');
    $('.item').toggleClass('on');
    $('#btn').toggleClass('x', false).toggleClass('y', true);
    return [$('#root').hasClass('b'), $('#root').hasClass('a'), $('.item').hasClass('on')];
  },
  'data, typed': () => [$('.item').data('page'), $('.item').data('id'), $('.item').data('list'), $('.item').data('flag'),
    $('.item').data('name'), $('.item').data('missing'), $('li[data-a]').data('a'), $('li[data-juz]').data('juz')],
  'toggle': () => {
    $('.tip kbd').toggle(false);
    const hidden = getComputedStyle($('.tip kbd')[0]).display;
    $('.tip kbd').toggle(true);
    return [hidden, getComputedStyle($('.tip kbd')[0]).display];
  },
  'appendTo, insertAfter, remove, empty': () => {
    $('<em class="new">e</em>').appendTo('#root');
    $('<div id="after"></div>').insertAfter($('#list')[0]);
    $('<span class="tip2"></span>').appendTo($('#btn'));
    $('.hide').remove();
    $('#note').empty();
    return [$('.new').length, $('#after').length];
  },
  'on: direct, delegated, this, return false, trigger': () => {
    const log = [];
    $('#btn').on('click', function (e) { log.push('direct:' + this.id + ':' + e.type); });
    $(document).on('click', '.item', function () { log.push('delegated:' + this.dataset.page); });
    $('#list').on('click', 'b', function () { log.push('inner:' + this.tagName); return false; });
    $('#btn').trigger('click');
    $('.item')[0].click();
    $('b')[0].click();
    $('#box').on('input change', function (e) { log.push(e.type); });
    $('#box')[0].dispatchEvent(new Event('input', { bubbles: true }));
    return log;
  },
  /* A saved page's delete button sits in its card; both are delegated from
     document, and the delete stops the card's handler from opening it */
  'delegated, inner and outer, stopPropagation': () => {
    const log = [];
    $(document).on('click', '#btn', function () { log.push('outer'); });
    $(document).on('click', '.tip', function (e) { log.push('inner'); e.stopPropagation(); });
    $(document).on('click', function () { log.push('document'); });
    $('kbd')[0].click();
    $(document).on('click', '#root', function () { log.push('root'); });
    $('#btn')[0].click();
    return log;
  },
};

async function run(browser, lib) {
  const page = await browser.newPage();
  const out = {};
  for (const [name, f] of Object.entries(CASES)) {
    // A new document each time, so no case sees another's listeners
    await page.goto('about:blank');
    await page.setContent(`<!doctype html><body>${MARKUP}</body>`);
    await page.addScriptTag({ content: lib });
    out[name] = await page.evaluate(`(() => { const r = (${f})(); return JSON.stringify({ r, dom: document.body.innerHTML }); })()`);
  }
  // Requests: getJSON, when, ajax, against a page served by route
  await page.route('**/ok.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"n":1}' }));
  await page.route('**/two.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[2]' }));
  await page.route('**/busy', (r) => r.fulfill({ status: 429, body: 'slow down' }));
  await page.route('**/post', (r) => r.fulfill({ status: 200, body: r.request().method() + ' ' + r.request().headers()['content-type'] + ' ' + r.request().postData() }));
  await page.goto('http://example.test/ok.json').catch(() => {});
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: lib });
  out.requests = await page.evaluate(() => new Promise((done) => {
    const log = [];
    $.when($.getJSON('http://example.test/ok.json'), $.getJSON('http://example.test/two.json'))
      .done((a, b) => log.push('when:' + JSON.stringify(a[0]) + JSON.stringify(b[0])))
      .fail(() => log.push('when failed'));
    $.getJSON('http://example.test/busy').fail((xhr) => log.push('fail:' + xhr.status));
    $.ajax({ url: 'http://example.test/post', method: 'POST', contentType: 'application/json', data: '{"x":1}', timeout: 5000 })
      .done((d) => log.push('ajax:' + d)).fail((x) => log.push('ajax failed ' + x.status)).always(() => log.push('always'));
    $.ajax({ url: 'http://example.test/busy', method: 'POST', data: 'x' }).fail((x) => log.push('ajax:' + x.status));
    setTimeout(() => done(JSON.stringify(log.sort())), 1500);
  }));
  await page.close();
  return out;
}

async function main() {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const a = await run(browser, JQUERY);
  const b = await run(browser, LITE);
  await browser.close();
  let failed = 0;
  console.log('\ndom.js against jQuery\n');
  for (const name of Object.keys(a)) {
    const ok = a[name] === b[name];
    if (!ok) failed++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (process.env.VERBOSE) console.log(`        ${b[name].slice(0, 300)}`);
    if (!ok) console.log(`        jQuery: ${a[name].slice(0, 400)}\n        dom.js: ${b[name].slice(0, 400)}`);
  }
  console.log(`\n${Object.keys(a).length - failed}/${Object.keys(a).length} checks passed.\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
