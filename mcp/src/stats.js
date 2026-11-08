/**
 * How much the MCP server is used, for the site's admin page (/admin/mcp/).
 *
 * Counts only: by UTC day, the calls, each tool's calls, the files fetched, the
 * errors, the connections by the app that made them (the name a client gives
 * as it connects, such as "claude-ai"), and the users: callers told apart by a
 * keyed hash of their address, the key made fresh each day and never written
 * down, so only the day's totals (by app and by Cloudflare's country) are kept.
 * And, for every call but a known scanner's, what is asked as totals of its choices
 * (which surah, translation, reciter, language, kind of file) and why calls fail,
 * from fixed lists: never free text, never tied to a caller. Ninety days.
 *
 * Who calls is told by kind: Claude.ai and ChatGPT by the address ranges they publish
 * (origin.js), apps on a reader's own machine by the name they give, scanners by theirs,
 * and the rest unverified. For all but scanners, each tool's errors and speed are counted;
 * and the last calls, their fixed choices only, are held in memory (never on disk) for
 * the admin page to look at and replay.
 *
 * Saved to a file when one is given (MCP_STATS_FILE, or systemd's state
 * directory) once a minute and on the way down; otherwise held in memory only.
 */
'use strict';

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');

const DAYS = 90;
const NAME = /^[\w .@/+-]{1,48}$/;     // what a client calls itself, kept only if it looks like a name
const COUNTRY = /^[A-Z]{2}$/;          // Cloudflare's CF-IPCountry; XX, T1 (Tor) or none count as ??
const MAX_SEEN = 200000;               // a day's callers held at most, so a flood cannot grow memory
const RECENT = 100;                    // the last calls the admin page can see and replay, in memory only
const SPEED = [100, 300, 1000, 3000];  // a call's time, in ms, counted by the band it falls in
// The apps readers use, by the name each gives (public/admin/mcp/mcp.js keeps the same list); the rest are scanners
const SCANNER = /probe|scan|crawl|check|audit|verif|monitor|health|bot\b|census|research|harvest|registry|catalog|index/i;
const ASSISTANT = /claude|anthropic|openai|chatgpt|gemini|visual studio code|vscode|copilot|cursor|windsurf|codeium|grok|xai|perplexity|mistral|le ?chat|^zed|^cline|roo-?code|^goose|lm ?studio/i;
const assistant = (app) => !SCANNER.test(app) && ASSISTANT.test(app);
// The choices counted, each only in the shape it can take, so nothing typed is kept
const CHOICES = {
  surah: (v) => Number.isInteger(v) && v >= 1 && v <= 114 ? String(v) : null,
  translation: (v) => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v) ? v : null,
  reciter: (v) => typeof v === 'string' && /^[a-z0-9-]{1,48}$/.test(v) ? v : null,
  language: (v) => typeof v === 'string' && /^[a-z]{2,3}$/i.test(v) ? v.toLowerCase() : null,
  kind: (v) => typeof v === 'string' && /^[a-z]{2,12}$/.test(v) ? v : null,
};
/* A call's arguments as far as they can be kept and replayed: numbers, ids and switches, never typed text */
const KEEP = { surah: 'int', ayah: 'int', to: 'int', limit: 'int', translation: 'id', reciter: 'id', language: 'id', kind: 'id', tafsir: 'flag' };
function keepArgs(args) {
  const out = {};
  if (!args || typeof args !== 'object') return out;
  for (const [k, type] of Object.entries(KEEP)) {
    const v = args[k];
    if (type === 'int' && Number.isInteger(v) && v >= 0 && v <= 100000) out[k] = v;
    else if (type === 'id' && typeof v === 'string' && /^[a-z0-9_-]{1,48}$/i.test(v)) out[k] = v;
    else if (type === 'flag' && typeof v === 'boolean') out[k] = v;
  }
  return out;
}
const KINDS = ['claude', 'chatgpt', 'app', 'unknown', 'scanner'];

/* A refusal's words without the protocol's preamble, and without anything quoted from the caller */
const plain = (reason) => String(reason || '')
  .replace(/^MCP error -?\d+:\s*/, '')
  .replace(/^Input validation error: Invalid arguments for tool [\w-]+:\s*/, 'Invalid arguments: ')
  .replace(/"[^"]*"/g, '"…"');

function createStats(file, { origin = () => null } = {}) {
  let days = {};
  if (file) {
    try { days = JSON.parse(fs.readFileSync(file, 'utf8')).days || {}; } catch (e) { /* first run */ }
  }
  let dirty = false;

  // Today's callers, as hashes under today's key: both live in memory only and go at midnight
  let seenDay = '', key = null, seen = new Map();
  // The last calls, newest first, and the caller each request is answered for: memory only
  const recent = [];
  const caller = new AsyncLocalStorage();

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

  const hash = (who) => crypto.createHmac('sha256', key).update(String(who.ip)).digest('base64').slice(0, 16);

  /* What kind of caller: an assistant's cloud by its address, else by the apps it named itself today */
  function kindOf(who) {
    if (!who || !who.ip) return { kind: 'unknown' };
    const o = origin(who.ip);
    if (o) return { kind: o };
    const apps = key ? seen.get(hash(who)) : null;
    if (apps && apps.size) {
      const app = [...apps].find(assistant);
      return app ? { kind: 'app', app } : { kind: 'scanner', app: [...apps][0] };
    }
    return { kind: 'unknown' };
  }

  /* A caller met today for the first time is a user: counted once, by country, by kind, and once for each app */
  function user(d, who, app) {
    if (!who || !who.ip) return;
    const h = hash(who);
    let apps = seen.get(h);
    if (!apps) {
      apps = new Set();
      if (seen.size < MAX_SEEN) seen.set(h, apps);
      d.users = (d.users || 0) + 1;
      d.countries = d.countries || {};
      bump(d.countries, COUNTRY.test(who.country || '') ? who.country : '??');
      const kind = origin(who.ip) || (app ? (assistant(app) ? 'app' : 'scanner') : 'unknown');
      bump(d.userKinds = d.userKinds || {}, kind);
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
        bump(d.callKinds = d.callKinds || {}, kindOf(who).kind);
      }
    }
  }

  const file_ = () => { today().files++; };
  /* A tool's answer that was a refusal: why, with what was quoted and every number taken out */
  function failed(tool, reason) {
    if (typeof tool !== 'string' || !NAME.test(tool)) return;
    const why = plain(reason).replace(/\d+/g, '#').slice(0, 100);
    const d = today();
    d.failed = d.failed || {};
    bump(d.failed[tool] = d.failed[tool] || {}, why);
  }
  /* Answers the next requests on behalf of this caller, so the tools' outcomes know who asked */
  const within = (who, fn) => caller.run(who || {}, fn);

  /* A tool call's answer, as it was sent: what was asked (the choices), whether it failed (a refusal, or arguments
     the tool would not take), how long it took. A replay from the admin page is not a reader and is not counted */
  function outcome(tool, args, r, ms, who = caller.getStore()) {
    if (typeof tool !== 'string' || !NAME.test(tool)) return;
    if (who && who.replay) return;
    const { kind, app } = kindOf(who);
    const failedNow = !!(r && r.isError);
    const text = (r && r.content && r.content[0] && r.content[0].text) || '';
    const d = today();
    if (kind !== 'scanner') {
      if (failedNow) failed(tool, text);
      // Only tools that exist get here, so a probe's made-up names are never counted as asked
      d.asked = d.asked || {};
      const t = d.asked[tool] = d.asked[tool] || {};
      for (const [k, shape] of Object.entries(CHOICES)) {
        const v = shape(args && args[k]);
        if (v !== null) bump(t[k] = t[k] || {}, v);
      }
      d.health = d.health || {};
      const h = d.health[tool] = d.health[tool] || { calls: 0, errors: 0, speed: [0, 0, 0, 0, 0] };
      h.calls++;
      if (failedNow) h.errors++;
      const band = SPEED.findIndex((x) => ms < x);
      h.speed[band < 0 ? SPEED.length : band]++;
    }
    recent.unshift({
      t: Date.now(), kind, app: app || undefined, tool, args: keepArgs(args), ok: !failedNow,
      why: failedNow ? plain(text).slice(0, 160) : undefined,
      ms: Math.round(ms), bytes: JSON.stringify(r || '').length,
    });
    if (recent.length > RECENT) recent.length = RECENT;
  }

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

  return {
    message, file: file_, failed, error, limited, save, within, outcome,
    snapshot: () => ({ days, kept: DAYS, saved: !!file, recent, kinds: KINDS, speed: SPEED }),
  };
}

/* Where to keep them: an explicit file, else systemd's state directory, else nowhere */
function statsFile() {
  if (process.env.MCP_STATS_FILE) return process.env.MCP_STATS_FILE;
  if (process.env.STATE_DIRECTORY) return path.join(process.env.STATE_DIRECTORY.split(':')[0], 'stats.json');
  return null;
}

module.exports = { createStats, statsFile, keepArgs };
