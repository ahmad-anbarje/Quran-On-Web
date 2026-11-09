/* The MCP server's counts, drawn from stats.json (the service's /stats, behind the admin password) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = null, surahs = null, onlyReal = true;
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var pct = function (a, b) { return b ? Math.round(a / b * 1000) / 10 + '%' : '–'; };
  var names = window.Intl && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

  // --- the callers ---
  /* The apps readers use, by the name each gives (mcp/src/stats.js keeps the same lists) */
  var ASSISTANTS = [
    ['Claude', /claude|anthropic/i], ['ChatGPT / Codex', /openai|chatgpt|codex/i], ['Gemini', /gemini/i],
    ['GitHub Copilot / VS Code', /visual studio code|vscode|copilot/i], ['Cursor', /cursor/i],
    ['Windsurf', /windsurf|codeium/i], ['Grok', /grok|xai/i], ['Perplexity', /perplexity/i],
    ['Mistral Le Chat', /mistral|le ?chat/i], ['Zed', /^zed/i], ['Cline', /^cline|roo-?code/i], ['Goose', /^goose/i], ['LM Studio', /lm ?studio/i]
  ];
  var SCANNER = /probe|scan|crawl|check|audit|verif|monitor|health|bot\b|census|research|harvest|registry|catalog|index/i;
  var family = function (app) { if (SCANNER.test(app)) return null; for (var i = 0; i < ASSISTANTS.length; i++) if (ASSISTANTS[i][1].test(app)) return ASSISTANTS[i][0]; return null; };
  var KIND = { claude: 'Claude.ai ✓', chatgpt: 'ChatGPT ✓', app: 'App', unknown: 'Unverified', owner: 'Your testing', scanner: 'Scanner' };
  var KIND_LONG = {
    claude: 'verified by Anthropic\'s published addresses',
    chatgpt: 'verified by OpenAI\'s published addresses',
    app: 'on a person\'s own machine, by the name it gives',
    unknown: 'called without saying who it is'
  };
  var READERS = ['claude', 'chatgpt', 'app', 'unknown'];

  var add = function (into, from) { Object.keys(from || {}).forEach(function (k) { into[k] = (into[k] || 0) + from[k]; }); };
  var sum = function (m, keys) { return (keys || Object.keys(m || {})).reduce(function (n, k) { return n + ((m && m[k]) || 0); }, 0); };

  /* A day's questions by kind; days counted before kinds were kept give their calls as unverified */
  var questionsOf = function (d) { return d.callKinds || { unknown: d.calls || 0 }; };

  function lastDays(n) {
    var out = [], d = new Date();
    for (var i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i)).toISOString().slice(0, 10));
    return out;
  }

  function country(code) {
    if (!/^[A-Z]{2}$/.test(code)) return { flag: '', name: 'Unknown' };
    var flag = String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
    var name = code;
    try { if (names) name = names.of(code) || code; } catch (e) { /* the code alone */ }
    return { flag: flag, name: name };
  }

  // --- drawing ---
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function none(tbody, cols, text) {
    var tr = el('tr'), td = el('td', 'dim', text || 'None yet');
    td.colSpan = cols;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  /* Rows sorted by the first number; label(key, td) fills the first cell */
  function rows(tbody, keys, cols, label) {
    tbody.textContent = '';
    var list = keys.map(function (k) { return [k].concat(cols.map(function (m) { return m[k] || 0; })); })
      .sort(function (a, b) { return b[1] - a[1] || (b[2] || 0) - (a[2] || 0); });
    if (!list.length) return none(tbody, cols.length + 1);
    list.forEach(function (r) {
      var tr = el('tr'), a = el('td');
      if (label) label(r[0], a); else a.textContent = r[0];
      tr.appendChild(a);
      r.slice(1).forEach(function (n) { tr.appendChild(el('td', 'n', fmt(n))); });
      tbody.appendChild(tr);
    });
  }

  function badge(kind, app) {
    var b = el('span', 'badge ' + kind, kind === 'app' || kind === 'scanner' ? (app || KIND[kind]) : KIND[kind]);
    b.title = KIND_LONG[kind] || '';
    return b;
  }
  function choices(args) { return Object.keys(args || {}).map(function (k) { return k + ' ' + args[k]; }).join(' · '); }
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return new Date(t).toLocaleString();
  }
  var size = function (b) { return b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' kB'; };

  function speedBar(speed, total) {
    var bar = el('div', 'speed');
    var labels = ['under 0.1 s', '0.1–0.3 s', '0.3–1 s', '1–3 s', 'over 3 s'];
    bar.title = speed.map(function (n, i) { return labels[i] + ': ' + n; }).join(' · ');
    speed.forEach(function (n) { var i = el('i'); i.style.width = (total ? n / total * 100 : 0) + '%'; bar.appendChild(i); });
    return bar;
  }

  function draw() {
    if (!data) return;
    var days = lastDays(Number($('range').value));
    var asks = {}, cards = {}, people = {}, persons = {}, chats = {}, clients = {}, userClients = {}, countries = {}, health = {}, failures = {};
    var asked = { surah: {}, translation: {}, reciter: {}, other: {} };
    var perDay = days.map(function (k) {
      var d = data.days[k];
      if (!d) return { real: 0, bot: 0 };
      var q = questionsOf(d);
      add(asks, q); add(cards, d.cardKinds); add(people, d.userKinds); add(persons, d.people); add(chats, d.chats);
      add(clients, d.clients); add(userClients, d.userClients); add(countries, d.countries);
      Object.keys(d.health || {}).forEach(function (t) {
        var h = health[t] = health[t] || { calls: 0, card: 0, errors: 0, speed: [0, 0, 0, 0, 0] };
        var g = d.health[t];
        h.calls += g.calls; h.card += g.card || 0; h.errors += g.errors;
        g.speed.forEach(function (n, i) { h.speed[i] += n; });
      });
      Object.keys(d.failed || {}).forEach(function (t) {
        Object.keys(d.failed[t]).forEach(function (why) { var key = t + ' · ' + why; failures[key] = (failures[key] || 0) + d.failed[t][why]; });
      });
      Object.keys(d.asked || {}).forEach(function (t) {
        Object.keys(d.asked[t]).forEach(function (key) {
          var into = asked[key] || asked.other;
          Object.keys(d.asked[t][key]).forEach(function (v) {
            var n = asked[key] ? v : (key === 'language' ? 'word by word: ' + v : key + ': ' + v);
            into[n] = (into[n] || 0) + d.asked[t][key][v];
          });
        });
      });
      return { real: sum(q, READERS), bot: q.scanner || 0 };
    });

    // Cards
    var today = data.days[days[days.length - 1]];
    $('cAsk').textContent = fmt(sum(asks, READERS));
    $('cAskToday').textContent = today ? fmt(sum(questionsOf(today), READERS)) + ' today' : '';
    $('cCard').textContent = fmt(sum(cards, READERS));
    var all = 0, bad = 0, fast = 0, slow = 0;
    Object.keys(health).forEach(function (t) {
      var h = health[t];
      all += h.calls; bad += h.errors; fast += h.speed[0] + h.speed[1]; slow += h.speed[3] + h.speed[4];
    });
    $('cErr').textContent = all ? pct(bad, all) : '–';
    $('cErrN').textContent = all ? fmt(bad) + ' of ' + fmt(all) + ' calls' : 'none yet';
    $('cardErr').className = 'card ' + (!all ? '' : bad / all > 0.1 ? 'bad' : bad / all > 0.02 ? 'warn' : 'good');
    $('cFast').textContent = all ? pct(fast, all) : '–';
    $('cSlow').textContent = all ? fmt(slow) + ' took over 1 s' : 'none yet';
    $('cardFast').className = 'card ' + (!all ? '' : fast / all < 0.7 ? 'warn' : 'good');
    // People: ChatGPT's anonymous readers, and each address of an app on a person's own machine; a day each, added up
    var gpt = persons.chatgpt || 0, onApps = people.app || 0;
    $('cPeople').textContent = fmt(gpt + onApps);
    $('cPeopleSplit').textContent = 'ChatGPT ' + fmt(gpt) + ' · apps ' + fmt(onApps) + ' · Claude.ai not countable';
    // People have been counted only for a while: a long period says from when, rather than looking empty
    var since = Object.keys(data.days).filter(function (k) { return data.days[k].userKinds || data.days[k].people; }).sort()[0];
    if (since && since > days[0]) $('cPeopleSplit').textContent += ' · counted since ' + since;
    var now = data.live || {};
    $('cLive').textContent = fmt(sum(now, READERS));
    var mine = (asks.owner || 0) + (cards.owner || 0);
    $('mine').textContent = mine ? 'Your own testing in this period: ' + fmt(mine) + ' calls, kept out of every count above.' : '';

    // Chart: readers' questions and scanners' calls, a day
    var max = Math.max.apply(null, perDay.map(function (p) { return p.real + p.bot; }).concat([1]));
    $('bars').textContent = '';
    perDay.forEach(function (p, i) {
      var b = el('div', 'bar');
      var r = el('i'); r.style.height = (p.real / max * 100) + 'px';
      var o = el('i', 'bot'); o.style.height = (p.bot / max * 100) + 'px';
      b.appendChild(r); b.appendChild(o);
      b.title = days[i] + ': ' + fmt(p.real) + ' questions from readers, ' + fmt(p.bot) + ' scanner calls';
      $('bars').appendChild(b);
    });
    $('from').textContent = days[0];
    $('to').textContent = days[days.length - 1];

    // Where readers come from
    var apps = {};
    Object.keys(userClients).forEach(function (a) { var f = family(a); if (f) apps[f] = 1; });
    var sb = $('sourceRows');
    sb.textContent = '';
    READERS.forEach(function (k) {
      var tr = el('tr'), td = el('td');
      td.appendChild(badge(k));
      td.appendChild(el('small', '', k === 'app' && Object.keys(apps).length ? Object.keys(apps).join(', ') : KIND_LONG[k]));
      tr.appendChild(td);
      // People: ChatGPT says who its readers are (anonymously); an app on a person's own machine is its address; the rest cannot be told
      tr.appendChild(el('td', 'n', k === 'chatgpt' ? fmt(persons.chatgpt) : k === 'app' ? fmt(people.app) : '—'));
      tr.appendChild(el('td', 'n', k === 'chatgpt' ? fmt(chats.chatgpt) : '—'));
      tr.appendChild(el('td', 'n', fmt(asks[k])));
      tr.appendChild(el('td', 'n dim', fmt(cards[k])));
      sb.appendChild(tr);
    });

    // Tools
    var tb = $('toolRows');
    tb.textContent = '';
    var tl = Object.keys(health).sort(function (a, b) { return health[b].calls - health[a].calls; });
    if (!tl.length) none(tb, 5, 'No readers\' calls in this period yet');
    tl.forEach(function (t) {
      var h = health[t], tr = el('tr');
      tr.appendChild(el('td', '', t));
      tr.appendChild(el('td', 'n', fmt(h.calls - h.card)));
      tr.appendChild(el('td', 'n dim', fmt(h.card)));
      tr.appendChild(el('td', 'n ' + (h.errors ? 'no' : ''), h.errors ? fmt(h.errors) + ' · ' + pct(h.errors, h.calls) : '0'));
      var sp = el('td'); sp.appendChild(speedBar(h.speed, h.calls)); tr.appendChild(sp);
      tb.appendChild(tr);
    });
    rows($('failures'), Object.keys(failures), [failures]);

    // What readers ask
    var top = function (m) { return Object.keys(m).filter(function (k) { return m[k]; }).sort(function (x, y) { return m[y] - m[x]; }).slice(0, 12); };
    rows($('askSurah'), top(asked.surah), [asked.surah], function (n, td) {
      var s = surahs && surahs[+n - 1];
      td.textContent = n + (s ? ' · ' + s.en : '');
    });
    rows($('askTranslation'), top(asked.translation), [asked.translation]);
    rows($('askReciter'), top(asked.reciter), [asked.reciter]);
    rows($('askOther'), top(asked.other), [asked.other]);

    // Countries and scanners
    rows($('countries'), Object.keys(countries), [countries], function (code, td) {
      var c = country(code);
      td.appendChild(el('span', 'flag', c.flag + ' '));
      td.appendChild(document.createTextNode(c.name));
    });
    var bot = { users: {}, conns: {} };
    Object.keys(clients).concat(Object.keys(userClients)).filter(function (k, i, list) { return list.indexOf(k) === i; }).forEach(function (a) {
      if (family(a)) return;
      bot.users[a] = userClients[a] || 0;
      bot.conns[a] = clients[a] || 0;
    });
    rows($('scanners'), Object.keys(bot.conns), [bot.users, bot.conns]);
    $('botCount').textContent = '(' + Object.keys(bot.conns).length + ')';

    drawRecent();
  }

  // --- the recent calls, and replaying one ---
  function drawRecent() {
    var tb = $('recentRows');
    tb.textContent = '';
    var list = (data.recent || []).filter(function (c) { return !onlyReal || READERS.indexOf(c.kind) >= 0; });
    if (!list.length) return none(tb, 7, data.recent ? 'No calls since the server last started' : 'This server does not keep recent calls yet');
    list.forEach(function (c) {
      var tr = el('tr');
      var when = el('td', 'dim', ago(c.t)); when.title = new Date(c.t).toLocaleString();
      tr.appendChild(when);
      var who = el('td'); who.appendChild(badge(c.kind, c.app)); tr.appendChild(who);
      var what = el('td'); what.appendChild(el('code', '', c.tool));
      what.appendChild(el('small', '', (c.card ? 'from the card' : 'asked by the AI') + (choices(c.args) ? ' · ' + choices(c.args) : '')));
      tr.appendChild(what);
      var res = el('td', c.ok ? 'ok' : 'no', c.ok ? 'OK' : 'Failed');
      if (!c.ok && c.why) res.appendChild(el('small', '', c.why));
      tr.appendChild(res);
      tr.appendChild(el('td', 'n' + (c.ms > 1000 ? ' no' : ''), c.ms + ' ms'));
      tr.appendChild(el('td', 'n dim', size(c.bytes)));
      var act = el('td'), btn = el('button', 'btn', 'Replay');
      // A search's words are not kept, so there is nothing to ask again
      if (c.tool === 'search' || c.tool === 'send_feedback') { btn.disabled = true; btn.title = 'Its words are not kept'; }
      btn.addEventListener('click', function () { replay(c, btn); });
      act.appendChild(btn);
      tr.appendChild(act);
      tb.appendChild(tr);
    });
  }

  function replay(c, btn) {
    btn.disabled = true;
    btn.textContent = '…';
    $('answer').hidden = false;
    $('answerTitle').textContent = c.tool + (choices(c.args) ? ' · ' + choices(c.args) : '');
    $('answerBody').textContent = 'Asking…';
    fetch('replay.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ tool: c.tool, args: c.args })
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { showAnswer(j.result || j.error || j); })
      .catch(function (e) { $('answerBody').textContent = ''; $('answerBody').appendChild(el('p', 'err', 'Could not replay (' + e.message + ').')); })
      .then(function () { btn.disabled = false; btn.textContent = 'Replay'; });
    $('answer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* The answer as the reader's assistant got it: each piece of content, text pretty-printed where it is JSON */
  function showAnswer(r) {
    var body = $('answerBody');
    body.textContent = '';
    if (r && r.isError) body.appendChild(el('p', 'no', 'The tool refused this call:'));
    var parts = (r && r.content) || [];
    if (!parts.length) body.appendChild(el('pre', '', JSON.stringify(r, null, 2)));
    parts.forEach(function (p) {
      var text = p.type === 'text' ? p.text : JSON.stringify(p, null, 2);
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* plain text stays as it is */ }
      body.appendChild(el('pre', '', text));
    });
    // The same answer as data only where no text carried it
    if (r && r.structuredContent && !parts.some(function (p) { return p.type === 'text'; })) body.appendChild(el('pre', '', JSON.stringify(r.structuredContent, null, 2)));
  }

  // --- controls ---
  function pressed(a, b, on) { a.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-pressed', String(!on)); }
  $('onlyReal').onclick = function () { onlyReal = true; pressed($('onlyReal'), $('allCalls'), true); drawRecent(); };
  $('allCalls').onclick = function () { onlyReal = false; pressed($('onlyReal'), $('allCalls'), false); drawRecent(); };
  $('answerClose').onclick = function () { $('answer').hidden = true; };
  $('range').onchange = draw;
  $('reload').onclick = load;

  // The surahs' names, for the asked surahs; drawn without them if they cannot come
  fetch('/data/surahs.json').then(function (r) { return r.json(); }).then(function (l) { surahs = l; draw(); }).catch(function () {});

  function load() {
    fetch('stats.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        data = d;
        $('note').textContent = d.saved ? '' : 'These counts are held in memory only and start again when the service restarts.';
        draw();
      })
      .catch(function (e) {
        $('note').textContent = '';
        $('note').appendChild(el('span', 'err', 'Could not read the counts (' + e.message + ').'));
      });
  }
  load();
})();
