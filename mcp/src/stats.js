/**
 * How much the MCP server is used, for the site's admin page (/admin/mcp/).
 *
 * Counts only: by UTC day, the calls, each tool's calls, the files fetched, the
 * errors, the connections by the app that made them (the name a client gives
 * as it connects, such as "claude-ai"), and the users: callers told apart by a
 * keyed hash of their address, the key made fresh each day and never written
 * down, so only the day's totals (by app and by Cloudflare's country) are kept.
 * No address and nothing asked is kept, as the privacy page says. Ninety days.
 *
 * Saved to a file when one is given (MCP_STATS_FILE, or systemd's state
 * directory) once a minute and on the way down; otherwise held in memory only.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DAYS = 90;
const NAME = /^[\w .@/+-]{1,48}$/;     // what a client calls itself, kept only if it looks like a name
const COUNTRY = /^[A-Z]{2}$/;          // Cloudflare's CF-IPCountry; XX, T1 (Tor) or none count as ??
const MAX_SEEN = 200000;               // a day's callers held at most, so a flood cannot grow memory

function createStats(file) {
  let days = {};
  if (file) {
    try { days = JSON.parse(fs.readFileSync(file, 'utf8')).days || {}; } catch (e) { /* first run */ }
  }
  let dirty = false;

  // Today's callers, as hashes under today's key: both live in memory only and go at midnight
  let seenDay = '', key = null, seen = new Map();

  function today() {
    const key_ = new Date().toISOString().slice(0, 10);
    if (seenDay !== key_) { seenDay = key_; key = crypto.randomBytes(32); seen = new Map(); }
    if (!days[key_]) {
      days[key_] = { calls: 0, tools: {}, clients: {}, files: 0, errors: 0, limited: 0, users: 0, userClients: {}, countries: {} };
      const keep = Object.keys(days).sort().slice(-DAYS);
      for (const k of Object.keys(days)) if (!keep.includes(k)) delete days[k];
    }
    dirty = true;
    return days[key_];
  }

  const bump = (map, key) => { map[key] = (map[key] || 0) + 1; };

  /* A caller met today for the first time is a user: counted once, by country, and once for each app */
  function user(d, who, app) {
    if (!who || !who.ip) return;
    const h = crypto.createHmac('sha256', key).update(String(who.ip)).digest('base64').slice(0, 16);
    let apps = seen.get(h);
    if (!apps) {
      apps = new Set();
      if (seen.size < MAX_SEEN) seen.set(h, apps);
      d.users = (d.users || 0) + 1;
      d.countries = d.countries || {};
      bump(d.countries, COUNTRY.test(who.country || '') ? who.country : '??');
    }
    if (app && !apps.has(app)) { apps.add(app); d.userClients = d.userClients || {}; bump(d.userClients, app); }
  }

  /* One JSON-RPC message, or a batch of them, as it arrives, from a caller ({ ip, country }) */
  function message(body, who) {
    for (const m of Array.isArray(body) ? body : [body]) {
      if (!m || typeof m !== 'object') continue;
      if (m.method === 'initialize') {
        const name = m.params && m.params.clientInfo && m.params.clientInfo.name;
        const app = typeof name === 'string' && NAME.test(name) ? name : 'unnamed';
        const d = today();
        bump(d.clients, app);
        user(d, who, app);
      } else if (m.method === 'tools/call') {
        const d = today();
        d.calls++;
        const tool = m.params && m.params.name;
        bump(d.tools, typeof tool === 'string' && NAME.test(tool) ? tool : 'other');
        user(d, who);
      }
    }
  }

  const file_ = () => { today().files++; };
  const error = () => { today().errors++; };
  const limited = () => { today().limited++; };

  function save() {
    if (!file || !dirty) return;
    dirty = false;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify({ days }));
      fs.renameSync(file + '.tmp', file);
    } catch (e) { console.error('stats not saved:', e.message); }
  }

  if (file) {
    setInterval(save, 60_000).unref();
    for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { save(); process.exit(0); });
  }

  return { message, file: file_, error, limited, save, snapshot: () => ({ days, kept: DAYS, saved: !!file }) };
}

/* Where to keep them: an explicit file, else systemd's state directory, else nowhere */
function statsFile() {
  if (process.env.MCP_STATS_FILE) return process.env.MCP_STATS_FILE;
  if (process.env.STATE_DIRECTORY) return path.join(process.env.STATE_DIRECTORY.split(':')[0], 'stats.json');
  return null;
}

module.exports = { createStats, statsFile };
