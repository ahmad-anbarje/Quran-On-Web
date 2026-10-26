/* The MCP server's counts, drawn from stats.json (the service's /stats, behind the admin password) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = null;
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };

  function lastDays(n) {
    var out = [], d = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
      out.push(x.toISOString().slice(0, 10));
    }
    return out;
  }

  function rows(tbody, map) {
    var list = Object.keys(map).map(function (k) { return [k, map[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    tbody.textContent = '';
    if (!list.length) {
      var none = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 2;
      cell.textContent = 'None yet';
      none.appendChild(cell);
      tbody.appendChild(none);
      return;
    }
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      var a = document.createElement('td'); a.textContent = r[0];
      var b = document.createElement('td'); b.className = 'n'; b.textContent = fmt(r[1]);
      tr.appendChild(a); tr.appendChild(b); tbody.appendChild(tr);
    });
  }

  function draw() {
    if (!data) return;
    var days = lastDays(Number($('range').value));
    var sum = { calls: 0, files: 0, errors: 0, limited: 0, conns: 0 }, tools = {}, clients = {};
    var per = days.map(function (k) {
      var d = data.days[k];
      if (!d) return 0;
      sum.calls += d.calls; sum.files += d.files; sum.errors += d.errors; sum.limited += d.limited || 0;
      Object.keys(d.tools).forEach(function (t) { tools[t] = (tools[t] || 0) + d.tools[t]; });
      Object.keys(d.clients).forEach(function (c) { clients[c] = (clients[c] || 0) + d.clients[c]; sum.conns += d.clients[c]; });
      return d.calls;
    });
    $('calls').textContent = fmt(sum.calls);
    $('conns').textContent = fmt(sum.conns);
    $('files').textContent = fmt(sum.files);
    $('limited').textContent = fmt(sum.limited);
    $('errors').textContent = fmt(sum.errors);
    var max = Math.max.apply(null, per.concat([1]));
    $('bars').textContent = '';
    per.forEach(function (n, i) {
      var b = document.createElement('div');
      b.className = 'bar';
      b.style.height = Math.max(2, n / max * 100) + '%';
      b.title = days[i] + ': ' + fmt(n) + ' calls';
      $('bars').appendChild(b);
    });
    $('from').textContent = days[0];
    $('to').textContent = days[days.length - 1];
    rows($('tools'), tools);
    rows($('clients'), clients);
  }

  $('range').onchange = draw;
  fetch('stats.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      data = d;
      if (!d.saved) $('note').textContent += ' These counts are held in memory only and start again when the service restarts.';
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
