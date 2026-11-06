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

  var add = function (into, from) { Object.keys(from || {}).forEach(function (k) { into[k] = (into[k] || 0) + from[k]; }); };

  function draw() {
    if (!data) return;
    var days = lastDays(Number($('range').value));
    var sum = { calls: 0, files: 0, errors: 0, limited: 0, conns: 0, users: 0 };
    var tools = {}, clients = {}, userClients = {}, countries = {}, counted = 0;
    var per = days.map(function (k) {
      var d = data.days[k];
      if (!d) return 0;
      sum.calls += d.calls; sum.files += d.files; sum.errors += d.errors; sum.limited += d.limited || 0;
      add(tools, d.tools); add(clients, d.clients); add(userClients, d.userClients); add(countries, d.countries);
      Object.keys(d.clients).forEach(function (c) { sum.conns += d.clients[c]; });
      // Days before users were counted say nothing about them, and are left out of the average
      if (d.users != null) { sum.users += d.users; counted++; }
      return chart === 'users' ? d.users || 0 : d.calls;
    });
    var today = data.days[days[days.length - 1]];
    $('usersToday').textContent = fmt(today && today.users);
    $('usersAvg').textContent = counted ? fmt(Math.round(sum.users / counted * 10) / 10) : '–';
    $('calls').textContent = fmt(sum.calls);
    $('conns').textContent = fmt(sum.conns);
    $('files').textContent = fmt(sum.files);
    $('limited').textContent = fmt(sum.limited);
    $('errors').textContent = fmt(sum.errors);

    $('chartTitle').textContent = chart === 'users' ? 'Users a day' : 'Tool calls a day';
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

    rows($('countries'), Object.keys(countries), [countries], function (code, td) {
      var c = country(code), f = document.createElement('span');
      f.className = 'flag'; f.textContent = c.flag;
      td.appendChild(f); td.appendChild(document.createTextNode(c.name));
    });
    var apps = Object.keys(clients).concat(Object.keys(userClients)).filter(function (k, i, all) { return all.indexOf(k) === i; });
    rows($('clients'), apps, [userClients, clients]);
    rows($('tools'), Object.keys(tools), [tools]);
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
