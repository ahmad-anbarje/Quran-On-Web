/* The MCP server's counts, drawn from stats.json (the service's /stats, behind the admin password) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = null;
  var chart = 'users';
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var names = window.Intl && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

  function lastDays(n) {
    var out = [], d = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
      out.push(x.toISOString().slice(0, 10));
    }
    return out;
  }

  /* A two-letter code as its flag and name; ?? where Cloudflare gave none */
  function country(code) {
    if (!/^[A-Z]{2}$/.test(code)) return { flag: '', name: 'Unknown' };
    var flag = String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
    var name = code;
    try { if (names) name = names.of(code) || code; } catch (e) { /* the code alone */ }
    return { flag: flag, name: name };
  }

  /* Rows sorted by the first number; label(key) gives the first cell's nodes */
  function rows(tbody, keys, cols, label) {
    tbody.textContent = '';
    var list = keys.map(function (k) { return [k].concat(cols.map(function (m) { return m[k] || 0; })); })
      .sort(function (a, b) { return b[1] - a[1] || (b[2] || 0) - (a[2] || 0); });
    if (!list.length) {
      var none = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = cols.length + 1;
      cell.textContent = 'None yet';
      none.appendChild(cell);
      tbody.appendChild(none);
      return;
    }
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      var a = document.createElement('td');
      if (label) label(r[0], a); else a.textContent = r[0];
      tr.appendChild(a);
      r.slice(1).forEach(function (n) {
        var b = document.createElement('td'); b.className = 'n'; b.textContent = fmt(n); tr.appendChild(b);
      });
      tbody.appendChild(tr);
    });
  }

  /* The apps readers use, by the name each gives as it connects; every other name is a scanner or directory */
  var ASSISTANTS = [
    ['Claude', /claude|anthropic/i], ['ChatGPT', /openai|chatgpt/i], ['Gemini', /gemini/i],
    ['GitHub Copilot / VS Code', /visual studio code|vscode|copilot/i], ['Cursor', /cursor/i],
    ['Windsurf', /windsurf|codeium/i], ['Grok', /grok|xai/i], ['Perplexity', /perplexity/i],
    ['Mistral Le Chat', /mistral|le ?chat/i], ['Zed', /^zed/i], ['Cline', /^cline|roo-?code/i], ['Goose', /^goose/i], ['LM Studio', /lm ?studio/i]
  ];
  var SCANNER = /probe|scan|crawl|check|audit|verif|monitor|health|bot\b|census|research|harvest|registry|catalog|index/i;
  var family = function (app) { if (SCANNER.test(app)) return null; for (var i = 0; i < ASSISTANTS.length; i++) if (ASSISTANTS[i][1].test(app)) return ASSISTANTS[i][0]; return null; };
  var TOOLS = ['get_ayah', 'get_ayah_image', 'search', 'get_tafsir', 'word_by_word', 'get_recitation', 'get_file', 'list_surahs', 'list_translations', 'list_reciters', 'send_feedback'];
  var people = function (d) { var n = 0; Object.keys(d.userClients || {}).forEach(function (k) { if (family(k)) n += d.userClients[k]; }); return n; };

  var add = function (into, from) { Object.keys(from || {}).forEach(function (k) { into[k] = (into[k] || 0) + from[k]; }); };

  function draw() {
    if (!data) return;
    var days = lastDays(Number($('range').value));
    var sum = { calls: 0, files: 0, errors: 0, limited: 0, people: 0 };
    var tools = {}, clients = {}, userClients = {}, countries = {}, counted = 0;
    var per = days.map(function (k) {
      var d = data.days[k];
      if (!d) return 0;
      sum.calls += d.calls; sum.files += d.files; sum.errors += d.errors; sum.limited += d.limited || 0;
      add(tools, d.tools); add(clients, d.clients); add(userClients, d.userClients); add(countries, d.countries);
      // Days before users were counted say nothing about them, and are left out of the average
      if (d.users != null) { sum.people += people(d); counted++; }
      return chart === 'users' ? people(d) : d.calls;
    });
    var today = data.days[days[days.length - 1]];
    $('peopleToday').textContent = fmt(today ? people(today) : 0);
    $('peopleAvg').textContent = counted ? fmt(Math.round(sum.people / counted * 10) / 10) : '–';
    $('bots').textContent = fmt(today && today.users != null ? today.users - people(today) : 0);
    $('calls').textContent = fmt(sum.calls);
    $('files').textContent = fmt(sum.files);
    $('problems').textContent = fmt(sum.errors) + ' · ' + fmt(sum.limited);

    $('chartTitle').textContent = chart === 'users' ? 'Users through AI assistants, a day' : 'Tool calls a day';
    var max = Math.max.apply(null, per.concat([1]));
    $('bars').textContent = '';
    per.forEach(function (n, i) {
      var b = document.createElement('div');
      b.className = 'bar';
      b.style.height = Math.max(2, n / max * 100) + '%';
      b.title = days[i] + ': ' + fmt(n) + (chart === 'users' ? ' users' : ' calls');
      $('bars').appendChild(b);
    });
    $('from').textContent = days[0];
    $('to').textContent = days[days.length - 1];

    // Each assistant summed over the names its apps give, which are listed under it
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
      var small = document.createElement('small');
      small.textContent = fam.names[f].join(', ');
      td.appendChild(small);
    });
    rows($('scanners'), Object.keys(bot.conns), [bot.users, bot.conns]);
    $('botCount').textContent = '(' + Object.keys(bot.conns).length + ')';

    rows($('countries'), Object.keys(countries), [countries], function (code, td) {
      var c = country(code), f = document.createElement('span');
      f.className = 'flag'; f.textContent = c.flag;
      td.appendChild(f); td.appendChild(document.createTextNode(c.name));
    });
    // Names that are not this server's tools are scanners' probes, kept as one row
    var mine = {}, other = 0;
    Object.keys(tools).forEach(function (t) { if (TOOLS.indexOf(t) >= 0) mine[t] = tools[t]; else other += tools[t]; });
    if (other) mine['Other names (scanners’ probes)'] = other;
    rows($('tools'), Object.keys(mine), [mine]);
  }

  function show(which) {
    chart = which;
    $('showUsers').setAttribute('aria-pressed', String(which === 'users'));
    $('showCalls').setAttribute('aria-pressed', String(which === 'calls'));
    draw();
  }
  $('showUsers').onclick = function () { show('users'); };
  $('showCalls').onclick = function () { show('calls'); };
  $('range').onchange = draw;

  fetch('stats.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      data = d;
      if (!d.saved) $('note').textContent = 'These counts are held in memory only and start again when the service restarts.';
      draw();
    })
    .catch(function (e) {
      var err = document.createElement('span');
      err.className = 'err';
      err.textContent = 'Could not read the counts (' + e.message + ').';
      $('note').textContent = '';
      $('note').appendChild(err);
    });
})();
