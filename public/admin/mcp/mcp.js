/* The MCP server's counts, drawn from stats.json (the service's /stats, behind the admin password) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = null, surahs = null;
  var chart = 'users', onlyReal = true;
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
  var KIND = { claude: 'Claude.ai ✓', chatgpt: 'ChatGPT ✓', app: 'App', unknown: 'Unverified', scanner: 'Scanner' };
  var KIND_LONG = {
    claude: ['Claude.ai', 'verified by Anthropic\'s published addresses'],
    chatgpt: ['ChatGPT', 'verified by OpenAI\'s published addresses'],
    app: ['Apps on readers\' machines', 'Claude Code, Cursor, VS Code, Gemini CLI… by the name they give'],
    unknown: ['Unverified', 'called without saying who it is'],
    scanner: ['Scanners & directories', 'by the name they give']
  };
  var REAL = ['claude', 'chatgpt', 'app'];
  var TOOLS = ['get_ayah', 'search', 'get_tafsir', 'word_by_word', 'get_recitation', 'get_file', 'list_surahs', 'list_translations', 'list_reciters', 'send_feedback'];

  var add = function (into, from) { Object.keys(from || {}).forEach(function (k) { into[k] = (into[k] || 0) + from[k]; }); };
  var sum = function (m, keys) { return (keys || Object.keys(m || {})).reduce(function (n, k) { return n + ((m && m[k]) || 0); }, 0); };

  /* A day's users and calls by kind; days counted before kinds were kept fall back on the app names */
  function kindsOf(d) {
    if (d.userKinds || d.callKinds) return { users: d.userKinds || {}, calls: d.callKinds || {} };
    var real = 0;
    Object.keys(d.userClients || {}).forEach(function (k) { if (family(k)) real += d.userClients[k]; });
    return { users: { app: real, scanner: Math.max(0, (d.users || 0) - real) }, calls: { unknown: d.calls || 0 } };
  }

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
    b.title = KIND_LONG[kind] ? KIND_LONG[kind].join(' — ') : '';
    return b;
  }

  function choices(args) {
    return Object.keys(args || {}).map(function (k) { return k + ' ' + args[k]; }).join(' · ');
  }

  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return new Date(t).toLocaleString();
  }
  var size = function (b) { return b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' kB'; };

  function draw() {
    if (!data) return;
    var days = lastDays(Number($('range').value));
    var users = {}, calls = {}, tools = {}, clients = {}, userClients = {}, countries = {}, health = {}, failures = {};
    var asked = { surah: {}, translation: {}, reciter: {}, other: {} };
    var perDay = days.map(function (k) {
      var d = data.days[k];
      if (!d) return { real: 0, bot: 0 };
      var kd = kindsOf(d);
      add(users, kd.users); add(calls, kd.calls);
      add(tools, d.tools); add(clients, d.clients); add(userClients, d.userClients); add(countries, d.countries);
      Object.keys(d.health || {}).forEach(function (t) {
        var h = health[t] = health[t] || { calls: 0, errors: 0, speed: [0, 0, 0, 0, 0] };
        h.calls += d.health[t].calls; h.errors += d.health[t].errors;
        d.health[t].speed.forEach(function (n, i) { h.speed[i] += n; });
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
      return chart === 'users'
        ? { real: sum(kd.users, REAL), bot: (kd.users.scanner || 0) + (kd.users.unknown || 0) }
        : { real: sum(kd.calls, REAL), bot: (kd.calls.scanner || 0) + (kd.calls.unknown || 0) };
    });
    // The asked tools themselves, by how many real calls each had
    Object.keys(health).forEach(function (t) { asked.other['tool: ' + t] = health[t].calls; });

    // Cards
    var today = data.days[days[days.length - 1]];
    var realUsers = sum(users, REAL), realCalls = sum(calls, REAL);
    $('cReal').textContent = fmt(realUsers);
    $('cRealToday').textContent = today ? fmt(sum(kindsOf(today).users, REAL)) + ' today' : '';
    $('cCalls').textContent = fmt(realCalls);
    $('cUnverified').textContent = calls.unknown ? '+ ' + fmt(calls.unknown) + ' unverified' : '';
    var hCalls = sum(Object.keys(health).map(function (t) { return health[t].calls; })), hErr = sum(Object.keys(health).map(function (t) { return health[t].errors; }));
    var fast = sum(Object.keys(health).map(function (t) { return health[t].speed[0] + health[t].speed[1]; }));
    var slow = sum(Object.keys(health).map(function (t) { return health[t].speed[3] + health[t].speed[4]; }));
    $('cErr').textContent = hCalls ? pct(hErr, hCalls) : '–';
    $('cErrN').textContent = hCalls ? fmt(hErr) + ' of ' + fmt(hCalls) + ' calls' : 'counted from now on';
    $('cardErr').className = 'card ' + (!hCalls ? '' : hErr / hCalls > 0.1 ? 'bad' : hErr / hCalls > 0.02 ? 'warn' : 'good');
    $('cFast').textContent = hCalls ? pct(fast, hCalls) : '–';
    $('cSlow').textContent = hCalls ? fmt(slow) + ' took over 1 s' : 'counted from now on';
    $('cardFast').className = 'card ' + (!hCalls ? '' : fast / hCalls < 0.7 ? 'warn' : 'good');
    $('cBots').textContent = fmt(users.scanner || 0);

    // Chart
    $('chartTitle').textContent = chart === 'users' ? 'Users a day' : 'Tool calls a day';
    var max = Math.max.apply(null, perDay.map(function (p) { return p.real + p.bot; }).concat([1]));
    $('bars').textContent = '';
    perDay.forEach(function (p, i) {
      var b = el('div', 'bar');
      var r = el('i'); r.style.height = (p.real / max * 100) + 'px';
      var o = el('i', 'bot'); o.style.height = (p.bot / max * 100) + 'px';
      b.appendChild(r); b.appendChild(o);
      b.title = days[i] + ': ' + fmt(p.real) + ' real, ' + fmt(p.bot) + ' scanners and unverified';
      $('bars').appendChild(b);
    });
    $('from').textContent = days[0];
    $('to').textContent = days[days.length - 1];

    // Health
    var hb = $('healthRows');
    hb.textContent = '';
    var ht = Object.keys(health).sort(function (a, b) { return health[b].calls - health[a].calls; });
    if (!ht.length) none(hb, 4, 'No real calls in this period yet');
    ht.forEach(function (t) {
      var h = health[t], tr = el('tr');
      tr.appendChild(el('td', '', t));
      tr.appendChild(el('td', 'n', fmt(h.calls)));
      var f = el('td', 'n ' + (h.errors ? 'no' : ''), h.errors ? fmt(h.errors) + ' · ' + pct(h.errors, h.calls) : '0');
      tr.appendChild(f);
      var sp = el('td'), bar = el('div', 'speed');
      var labels = ['under 0.1 s', '0.1–0.3 s', '0.3–1 s', '1–3 s', 'over 3 s'];
      bar.title = h.speed.map(function (n, i) { return labels[i] + ': ' + n; }).join(' · ');
      h.speed.forEach(function (n) { var i = el('i'); i.style.width = (n / h.calls * 100) + '%'; bar.appendChild(i); });
      sp.appendChild(bar);
      tr.appendChild(sp);
      hb.appendChild(tr);
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

    // Who
    var kb = $('kinds');
    kb.textContent = '';
    ['claude', 'chatgpt', 'app', 'unknown', 'scanner'].forEach(function (k) {
      var tr = el('tr'), td = el('td');
      td.appendChild(badge(k));
      td.appendChild(el('small', '', KIND_LONG[k][1]));
      tr.appendChild(td);
      tr.appendChild(el('td', 'n', fmt(users[k])));
      tr.appendChild(el('td', 'n', fmt(calls[k])));
      kb.appendChild(tr);
    });
    var fam = { users: {}, conns: {}, names: {} }, bot = { users: {}, conns: {} };
    Object.keys(clients).concat(Object.keys(userClients)).filter(function (k, i, all) { return all.indexOf(k) === i; }).forEach(function (app) {
      var f = family(app);
      if (f) {
        fam.users[f] = (fam.users[f] || 0) + (userClients[app] || 0);
        fam.conns[f] = (fam.conns[f] || 0) + (clients[app] || 0);
        (fam.names[f] = fam.names[f] || []).push(app);
      } else {
        bot.users[app] = userClients[app] || 0;
        bot.conns[app] = clients[app] || 0;
      }
    });
    rows($('assistants'), Object.keys(fam.conns), [fam.users, fam.conns], function (f, td) {
      td.textContent = f;
      td.appendChild(el('small', '', fam.names[f].join(', ')));
    });
    rows($('countries'), Object.keys(countries), [countries], function (code, td) {
      var c = country(code);
      td.appendChild(el('span', 'flag', c.flag + ' '));
      td.appendChild(document.createTextNode(c.name));
    });
    var mine = {}, other = 0;
    Object.keys(tools).forEach(function (t) { if (TOOLS.indexOf(t) >= 0) mine[t] = tools[t]; else other += tools[t]; });
    if (other) mine['other names (scanners’ probes)'] = other;
    rows($('tools'), Object.keys(mine), [mine]);
    rows($('scanners'), Object.keys(bot.conns), [bot.users, bot.conns]);
    $('botCount').textContent = '(' + Object.keys(bot.conns).length + ')';

    drawRecent();
  }

  // --- the recent calls, and replaying one ---
  function drawRecent() {
    var tb = $('recentRows');
    tb.textContent = '';
    var list = (data.recent || []).filter(function (c) { return !onlyReal || c.kind !== 'scanner'; });
    if (!list.length) return none(tb, 7, data.recent ? 'No calls since the server last started' : 'This server does not keep recent calls yet');
    list.forEach(function (c) {
      var tr = el('tr');
      var when = el('td', 'dim', ago(c.t)); when.title = new Date(c.t).toLocaleString();
      tr.appendChild(when);
      var who = el('td'); who.appendChild(badge(c.kind, c.app)); tr.appendChild(who);
      var what = el('td'); what.appendChild(el('code', '', c.tool));
      var ch = choices(c.args);
      if (ch) what.appendChild(el('small', '', ch));
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
      if (p.type === 'image' && p.data) {
        var img = el('img'); img.src = 'data:' + (p.mimeType || 'image/png') + ';base64,' + p.data; img.alt = 'The image the tool returned';
        body.appendChild(img);
        return;
      }
      var text = p.type === 'text' ? p.text : JSON.stringify(p, null, 2);
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* plain text stays as it is */ }
      body.appendChild(el('pre', '', text));
    });
    // The same answer as data only where no text carried it
    if (r && r.structuredContent && !parts.some(function (p) { return p.type === 'text'; })) body.appendChild(el('pre', '', JSON.stringify(r.structuredContent, null, 2)));
  }

  // --- controls ---
  function pressed(a, b, on) { a.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-pressed', String(!on)); }
  $('showUsers').onclick = function () { chart = 'users'; pressed($('showUsers'), $('showCalls'), true); draw(); };
  $('showCalls').onclick = function () { chart = 'calls'; pressed($('showUsers'), $('showCalls'), false); draw(); };
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
